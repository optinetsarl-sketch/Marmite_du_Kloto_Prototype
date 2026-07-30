"""AppConfigs MongoDB-compatibles pour les apps Django intégrées.

django-mongodb-backend exige ObjectIdAutoField au lieu de AutoField/BigAutoField.
Ces sous-classes forcent le default_auto_field pour admin, auth et contenttypes.
"""

import sys
from django.contrib.admin.apps import AdminConfig
from django.contrib.auth.apps import AuthConfig
from django.contrib.contenttypes.apps import ContentTypesConfig

if "test" in sys.argv:
    _default_field = "django.db.models.AutoField"
else:
    _default_field = "django_mongodb_backend.fields.ObjectIdAutoField"


class MongoAdminConfig(AdminConfig):
    default_auto_field = _default_field


class MongoAuthConfig(AuthConfig):
    default_auto_field = _default_field


class MongoContentTypesConfig(ContentTypesConfig):
    default_auto_field = _default_field
