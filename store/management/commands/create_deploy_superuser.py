
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create a deployment superuser once, using environment variables."

    def handle(self, *args, **options):
        username = os.environ.get("DEPLOY_ADMIN_USERNAME")
        password = os.environ.get("DEPLOY_ADMIN_PASSWORD")
        email = os.environ.get("DEPLOY_ADMIN_EMAIL", "")

        if not username or not password:
            self.stdout.write("Admin creation skipped: credentials not set.")
            return

        User = get_user_model()

        if User.objects.filter(username=username).exists():
            self.stdout.write("Admin user already exists; no changes made.")
            return

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write("Deployment admin created successfully.")

