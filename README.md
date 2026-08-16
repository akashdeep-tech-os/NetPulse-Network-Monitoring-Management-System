# NetPulse-Network-Monitoring-Management-System

Platform admin (in backend/admin_credentials.txt):

- Username: admin
- Password: ZU6vKegMeupXx0TK
  Demo org owner (hardcoded in database/seed.py:132):
- Username: demo / Password: Demo@1234

Seeded. 4 new users added to the demo org (existing admin/demo kept):
Type Username
Super admin superadmin
Org admin orgadmin
Regular user user
Viewer viewer
Implemented in backend/database/seed.py (\_seed_role_users); it runs automatically on app startup and is idempotent, so restarting won't duplicate them.
