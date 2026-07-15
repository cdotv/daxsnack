from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_alter_subscription_id"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE core_subscription "
                "ADD COLUMN IF NOT EXISTS language varchar(2) NOT NULL DEFAULT 'en';"
            ),
            reverse_sql=(
                # No-op reverse; keep the column in place
                "SELECT 1;"
            ),
        ),
    ]
