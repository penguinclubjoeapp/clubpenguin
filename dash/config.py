import os

# Server bind
ADDRESS = '0.0.0.0'
PORT = int(os.environ.get('DASH_PORT', 3000))

# PostgreSQL credentials (Houdini's database)
POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'postgres')
POSTGRES_NAME = os.environ.get('POSTGRES_DB', 'penguin')
POSTGRES_USER = os.environ.get('POSTGRES_USER', 'penguin')
POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'changeme')

# Redis
REDIS_ADDRESS = os.environ.get('REDIS_HOST', 'redis')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

# Google reCAPTCHA (optional — leave blank to disable)
GCAPTCHA_URL = 'https://www.google.com/recaptcha/api/siteverify'
GSITE_KEY = os.environ.get('WEB_RECAPTCHA_SITE', '')
GSECRET_KEY = os.environ.get('WEB_RECAPTCHA_SECRET', '')

# Player usernames
USERNAME_FORCE_CASE = True
APPROVE_USERNAME = True

# Player activation — auto-activate for private server (no email verification)
ACTIVATE_PLAYER = True
LEGACY_ACTIVATE_REDIRECT = 'http://' + os.environ.get('WEB_HOSTNAME', 'localhost')
VANILLA_ACTIVATE_REDIRECT = 'http://' + os.environ.get('WEB_HOSTNAME', 'localhost')

# Email (optional — leave EMAIL_METHOD blank to disable)
EMAIL_METHOD = ''
SITE_NAME = 'Club Penguin'
FROM_EMAIL = 'noreply@' + os.environ.get('WEB_HOSTNAME', 'localhost')
SENDGRID_API_KEY = os.environ.get('WEB_SENDGRID_KEY', '')
EMAIL_WHITELIST = []
MAX_ACCOUNT_EMAIL = 5

# Must match Houdini's auth key (default: 'houdini')
STATIC_KEY = 'houdini'

# Play page links
_hostname = os.environ.get('WEB_HOSTNAME', 'localhost')
LEGACY_PLAY_LINK = f'http://{_hostname}'
VANILLA_PLAY_LINK = f'http://{_hostname}'

# Password reset
AUTH_TTL = 3600
PASSWORD_REDIRECT = ''

# Login rate limiting
LOGIN_FAILURE_TIMER = 3600
LOGIN_FAILURE_LIMIT = 5

# Card-Jitsu Snow (not used)
CJS_HOST = 'localhost'
CJS_PORT = 7002
