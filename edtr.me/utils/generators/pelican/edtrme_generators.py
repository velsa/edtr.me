import os
import math
import random
import logging
import datetime
from operator import attrgetter, itemgetter
from collections import defaultdict

from pelican import signals, contents
from pelican.readers import read_file
from pelican.generators import ArticlesGenerator, PagesGenerator
from pelican.contents import Article, Page, Category, is_valid_content
from pelican.utils import process_translations
from pelican.plugins.sitemap import SitemapGenerator, format_date, XML_URL


logger = logging.getLogger(__name__)


class EdtrmeArticlesGenerator(ArticlesGenerator):

    def generate_context(self):
        """Add the articles into the shared context"""

        article_path = os.path.normpath(  # we have to remove trailing slashes
            os.path.join(self.path, self.settings['ARTICLE_DIR'])
        )
        all_articles = []
        for f in self.get_files(
                article_path,
                exclude=self.settings['ARTICLE_EXCLUDES']):
            try:
                signals.article_generate_preread.send(self)
                content, metadata = read_file(f, settings=self.settings)
            except Exception, e:
                logger.warning(u'Could not process %s\n%s' % (f, str(e)))
                continue

            # if no category is set, use the name of the path as a category
            if 'category' not in metadata:

                if (self.settings['USE_FOLDER_AS_CATEGORY']
                  and os.path.dirname(f) != article_path):
                    # if the article is in a subdirectory
                    category = os.path.basename(os.path.dirname(f))\
                        .decode('utf-8')
                else:
                    # if the article is not in a subdirectory
                    category = self.settings['DEFAULT_CATEGORY']

                if category != '':
                    metadata['category'] = Category(category, self.settings)

            if 'date' not in metadata and self.settings.get('DEFAULT_DATE'):
                if self.settings['DEFAULT_DATE'] == 'fs':
                    metadata['date'] = datetime.datetime.fromtimestamp(
                        os.stat(f).st_ctime)
                else:
                    metadata['date'] = datetime.datetime(
                        *self.settings['DEFAULT_DATE'])

            signals.article_generate_context.send(self, metadata=metadata)
            article = Article(content, metadata, settings=self.settings,
                              filename=f, context=self.context)
            if not is_valid_content(article, f):
                continue

            self.add_filename(article)

            if article.status in ("published", "draft"):
                if hasattr(article, 'tags'):
                    for tag in article.tags:
                        self.tags[tag].append(article)
                all_articles.append(article)
            # elif article.status == "draft":
            #     self.drafts.append(article)
            else:
                logger.warning(u"Unknown status %s for file %s, skipping it." %
                               (repr(unicode.encode(article.status, 'utf-8')),
                                repr(f)))

        self.articles, self.translations = process_translations(all_articles)

        for article in self.articles:
            # only main articles are listed in categories, not translations
            self.categories[article.category].append(article)
            # ignore blank authors as well as undefined
            if hasattr(article, 'author') and article.author.name != '':
                self.authors[article.author].append(article)

        # sort the articles by date
        self.articles.sort(key=attrgetter('date'), reverse=True)
        self.dates = list(self.articles)
        self.dates.sort(key=attrgetter('date'),
                reverse=self.context['NEWEST_FIRST_ARCHIVES'])

        # create tag cloud
        tag_cloud = defaultdict(int)
        for article in self.articles:
            for tag in getattr(article, 'tags', []):
                tag_cloud[tag] += 1

        tag_cloud = sorted(tag_cloud.items(), key=itemgetter(1), reverse=True)
        tag_cloud = tag_cloud[:self.settings.get('TAG_CLOUD_MAX_ITEMS')]

        tags = map(itemgetter(1), tag_cloud)
        if tags:
            max_count = max(tags)
        steps = self.settings.get('TAG_CLOUD_STEPS')

        # calculate word sizes
        self.tag_cloud = [
            (
                tag,
                int(math.floor(steps - (steps - 1) * math.log(count)
                    / (math.log(max_count)or 1)))
            )
            for tag, count in tag_cloud
        ]
        # put words in chaos
        random.shuffle(self.tag_cloud)

        # and generate the output :)

        # order the categories per name
        self.categories = list(self.categories.items())
        self.categories.sort(
            key=lambda item: item[0].name,
            reverse=self.settings['REVERSE_CATEGORY_ORDER'])

        self.authors = list(self.authors.items())
        self.authors.sort(key=lambda item: item[0].name)

        self._update_context(('articles', 'dates', 'tags', 'categories',
                              'tag_cloud', 'authors', 'related_posts'))

        signals.article_generator_finalized.send(self)


class EdtrmePagesGenerator(PagesGenerator):
    def generate_context(self):
        all_pages = []
        hidden_pages = []
        for f in self.get_files(
                os.path.join(self.path, self.settings['PAGE_DIR']),
                exclude=self.settings['PAGE_EXCLUDES']):
            try:
                content, metadata = read_file(f, settings=self.settings)
            except Exception, e:
                logger.warning(u'Could not process %s\n%s' % (f, str(e)))
                continue
            signals.pages_generate_context.send(self, metadata=metadata)
            page = Page(content, metadata, settings=self.settings,
                        filename=f, context=self.context)
            if not is_valid_content(page, f):
                continue

            self.add_filename(page)

            if page.status in ("published", "draft"):
                all_pages.append(page)
            elif page.status == "hidden":
                hidden_pages.append(page)
            else:
                logger.warning(u"Unknown status %s for file %s, skipping it." %
                               (repr(unicode.encode(page.status, 'utf-8')),
                                repr(f)))

        self.pages, self.translations = process_translations(all_pages)
        self.hidden_pages, self.hidden_translations = process_translations(hidden_pages)

        self._update_context(('pages', ))
        self.context['PAGES'] = self.pages


class EdtrmeSitemapGenerator(SitemapGenerator):

    def write_url(self, page, fd):

        if getattr(page, 'status', 'published') not in ('published', 'draft'):
            return

        page_path = os.path.join(self.output_path, page.url)
        if not os.path.exists(page_path):
            return

        lastmod = format_date(getattr(page, 'date', self.now))

        if isinstance(page, contents.Article):
            pri = self.priorities['articles']
            chfreq = self.changefreqs['articles']
        elif isinstance(page, contents.Page):
            pri = self.priorities['pages']
            chfreq = self.changefreqs['pages']
        else:
            pri = self.priorities['indexes']
            chfreq = self.changefreqs['indexes']

        if self.format == 'xml':
            fd.write(XML_URL.format(self.siteurl, page.url, lastmod, chfreq, pri))
        else:
            fd.write(self.siteurl + '/' + loc + '\n')
