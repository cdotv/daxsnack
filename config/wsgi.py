import os

from core.file_security import apply_private_umask
from core.runtime_limits import apply_process_thread_env_defaults

from django.core.wsgi import get_wsgi_application

apply_private_umask()
apply_process_thread_env_defaults()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()
