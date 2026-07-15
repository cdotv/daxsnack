from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Subscription",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=False)),
                ("confirm_token_hash", models.CharField(blank=True, max_length=128)),
                (
                    "unsubscribe_token_hash",
                    models.CharField(blank=True, max_length=128),
                ),
                ("language", models.CharField(default="en", max_length=2)),
            ],
        ),
    ]
