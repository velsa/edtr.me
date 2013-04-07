import os
import re
import sys
import logging
import shutil

from pelican import signals

from pelican.generators import (StaticGenerator, PdfGenerator,
                                SourceFileGenerator, TemplatePagesGenerator)
from pelican.log import init
from pelican.settings import read_settings
from pelican.utils import clean_output_dir
from pelican.writers import Writer

from edtrme_generators import EdtrmeArticlesGenerator, EdtrmePagesGenerator

__major__ = 3
__minor__ = 1
__micro__ = 1
__version__ = "{0}.{1}.{2}".format(__major__, __minor__, __micro__)


logger = logging.getLogger(__name__)


class Pelican(object):
    def __init__(self, settings):
        """
        Pelican initialisation, performs some checks on the environment before
        doing anything else.
        """

        # define the default settings
        self.settings = settings
        self._handle_deprecation()

        self.path = settings['PATH']
        self.theme = settings['THEME']
        self.output_path = settings['OUTPUT_PATH']
        self.markup = settings['MARKUP']
        self.delete_outputdir = settings['DELETE_OUTPUT_DIRECTORY']

        self.init_path()
        self.init_plugins()
        signals.initialized.send(self)

    def init_path(self):
        if not any(p in sys.path for p in ['', '.']):
            logger.debug("Adding current directory to system path")
            sys.path.insert(0, '')

    def init_plugins(self):
        self.plugins = self.settings['PLUGINS']
        for plugin in self.plugins:
            # if it's a string, then import it
            if isinstance(plugin, basestring):
                logger.debug("Loading plugin `{0}' ...".format(plugin))
                plugin = __import__(plugin, globals(), locals(), 'module')

            logger.debug("Registering plugin `{0}'".format(plugin.__name__))
            plugin.register()

    def _handle_deprecation(self):

        if self.settings.get('CLEAN_URLS', False):
            logger.warning('Found deprecated `CLEAN_URLS` in settings.'
                        ' Modifying the following settings for the'
                        ' same behaviour.')

            self.settings['ARTICLE_URL'] = '{slug}/'
            self.settings['ARTICLE_LANG_URL'] = '{slug}-{lang}/'
            self.settings['PAGE_URL'] = 'pages/{slug}/'
            self.settings['PAGE_LANG_URL'] = 'pages/{slug}-{lang}/'

            for setting in ('ARTICLE_URL', 'ARTICLE_LANG_URL', 'PAGE_URL',
                            'PAGE_LANG_URL'):
                logger.warning("%s = '%s'" % (setting, self.settings[setting]))

        if self.settings.get('ARTICLE_PERMALINK_STRUCTURE', False):
            logger.warning('Found deprecated `ARTICLE_PERMALINK_STRUCTURE` in'
                        ' settings.  Modifying the following settings for'
                        ' the same behaviour.')

            structure = self.settings['ARTICLE_PERMALINK_STRUCTURE']

            # Convert %(variable) into {variable}.
            structure = re.sub('%\((\w+)\)s', '{\g<1>}', structure)

            # Convert %x into {date:%x} for strftime
            structure = re.sub('(%[A-z])', '{date:\g<1>}', structure)

            # Strip a / prefix
            structure = re.sub('^/', '', structure)

            for setting in ('ARTICLE_URL', 'ARTICLE_LANG_URL', 'PAGE_URL',
                            'PAGE_LANG_URL', 'ARTICLE_SAVE_AS',
                            'ARTICLE_LANG_SAVE_AS', 'PAGE_SAVE_AS',
                            'PAGE_LANG_SAVE_AS'):
                self.settings[setting] = os.path.join(structure,
                                                      self.settings[setting])
                logger.warning("%s = '%s'" % (setting, self.settings[setting]))

        if self.settings.get('FEED', False):
            logger.warning('Found deprecated `FEED` in settings. Modify FEED'
            ' to FEED_ATOM in your settings and theme for the same behavior.'
            ' Temporarily setting FEED_ATOM for backwards compatibility.')
            self.settings['FEED_ATOM'] = self.settings['FEED']

        if self.settings.get('TAG_FEED', False):
            logger.warning('Found deprecated `TAG_FEED` in settings. Modify '
            ' TAG_FEED to TAG_FEED_ATOM in your settings and theme for the '
            'same behavior. Temporarily setting TAG_FEED_ATOM for backwards '
            'compatibility.')
            self.settings['TAG_FEED_ATOM'] = self.settings['TAG_FEED']

        if self.settings.get('CATEGORY_FEED', False):
            logger.warning('Found deprecated `CATEGORY_FEED` in settings. '
            'Modify CATEGORY_FEED to CATEGORY_FEED_ATOM in your settings and '
            'theme for the same behavior. Temporarily setting '
            'CATEGORY_FEED_ATOM for backwards compatibility.')
            self.settings['CATEGORY_FEED_ATOM'] =\
                    self.settings['CATEGORY_FEED']

        if self.settings.get('TRANSLATION_FEED', False):
            logger.warning('Found deprecated `TRANSLATION_FEED` in settings. '
            'Modify TRANSLATION_FEED to TRANSLATION_FEED_ATOM in your '
            'settings and theme for the same behavior. Temporarily setting '
            'TRANSLATION_FEED_ATOM for backwards compatibility.')
            self.settings['TRANSLATION_FEED_ATOM'] =\
                    self.settings['TRANSLATION_FEED']

    def run(self):
        """Run the generators and return"""

        context = self.settings.copy()
        context['filenames'] = {}  # share the dict between all the generators
        context['localsiteurl'] = self.settings.get('SITEURL')  # share
        generators = [
            cls(
                context,
                self.settings,
                self.path,
                self.theme,
                self.output_path,
                self.markup,
            ) for cls in self.get_generator_classes()
        ]

        for p in generators:
            if hasattr(p, 'generate_context'):
                p.generate_context()

        # erase the directory if it is not the source and if that's
        # explicitely asked
        if (self.delete_outputdir and not
                os.path.realpath(self.path).startswith(self.output_path)):
            clean_output_dir(self.output_path)

        writer = self.get_writer()

        for p in generators:
            if hasattr(p, 'generate_output'):
                p.generate_output(writer)

        signals.finalized.send(self)

    def get_generator_classes(self):
        generators = [StaticGenerator, EdtrmeArticlesGenerator,
            EdtrmePagesGenerator]

        if self.settings['TEMPLATE_PAGES']:
            generators.append(TemplatePagesGenerator)
        if self.settings['PDF_GENERATOR']:
            generators.append(PdfGenerator)
        if self.settings['OUTPUT_SOURCES']:
            generators.append(SourceFileGenerator)

        for pair in signals.get_generators.send(self):
            (funct, value) = pair

            if not isinstance(value, (tuple, list)):
                value = (value, )

            for v in value:
                if isinstance(v, type):
                    logger.debug('Found generator: {0}'.format(v))
                    generators.append(v)

        return generators

    def get_writer(self):
        return Writer(self.output_path, settings=self.settings)


def get_instance(path, output_path, markup):
    settings = read_settings(None, override={})
    settings['PATH'] = path
    settings['OUTPUT_PATH'] = output_path
    settings['MARKUP'] = markup
    return Pelican(settings)


def run_pelican(path, output_path, markup=['md']):
    verbosity = logging.DEBUG
    init(verbosity)

    if os.path.exists(output_path):
        for p in os.listdir(output_path):
            p = os.path.join(output_path, p)
            if os.path.isdir(p):
                shutil.rmtree(p)
            else:
                os.remove(p)

    pelican = get_instance(path, output_path, markup)

    try:
        pelican.run()
    except Exception, e:
        logger.critical(unicode(e))

        if (verbosity == logging.DEBUG):
            raise
        else:
            sys.exit(getattr(e, 'exitcode', 1))
