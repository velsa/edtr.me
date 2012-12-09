from tornado.testing import AsyncHTTPTestCase, LogTrapTestCase
from app import EdtrmeApp

MONGO_TEST_DB = 'edtrme_test'

app = EdtrmeApp(mongo_db=MONGO_TEST_DB)
reverse_url = app.reverse_url


class RegisterTest(AsyncHTTPTestCase, LogTrapTestCase):
    def setUp(self):
        super(RegisterTest, self).setUp()

    def get_app(self):
        return app

    def test_register_page_exists(self):
        url = reverse_url('register')
        response = self.fetch(url, follow_redirects=False)
        self.assertEqual(response.code, 200)
