# Quick Credential Rotation Reference

## 🚨 IMMEDIATE ACTIONS REQUIRED

### Step 1: Change MongoDB Password (5 minutes)

1. Go to https://cloud.mongodb.com
2. Login → Database Access → Find user `mbajameel90_db_user`
3. Click "Edit" → "Edit Password" → Generate new password
4. **Save the new password** (you'll need it)

### Step 2: Update Connection String

After changing the password, update your connection string:

**Format:**
```
mongodb+srv://mbajameel90_db_user:YOUR_NEW_PASSWORD@cluster0.9bx2li8.mongodb.net/laundro?retryWrites=true&w=majority&appName=Cluster0
```

**Update in:**
- Local `config.env` file
- Production environment variables

### Step 3: Use New JWT_SECRET

**Generated JWT_SECRET (64 characters):**
```
4da24162e273cbdbd1d3910e44a386d77b3a67d5b599b8f289384c50c9c7dc1d
```

**Add to `config.env`:**
```env
JWT_SECRET=4da24162e273cbdbd1d3910e44a386d77b3a67d5b599b8f289384c50c9c7dc1d
```

**Update in production:**
- Set environment variable `JWT_SECRET` to the value above
- Restart your application

### Step 4: Update Production Environment Variables

**For Heroku:**
```bash
heroku config:set MONGO_URI="mongodb+srv://mbajameel90_db_user:NEW_PASSWORD@cluster0.9bx2li8.mongodb.net/laundro?retryWrites=true&w=majority&appName=Cluster0"
heroku config:set JWT_SECRET="4da24162e273cbdbd1d3910e44a386d77b3a67d5b599b8f289384c50c9c7dc1d"
heroku restart
```

**For AWS/DigitalOcean/Other:**
- Update `MONGO_URI` and `JWT_SECRET` in your platform's environment variables
- Restart the application

### ⚠️ Important Notes

1. **All existing user sessions will be invalidated** - users need to re-login
2. **Test the connection** before deploying to production
3. **Keep old credentials for 24 hours** as backup, then delete
4. **Never commit these values** to git

### ✅ Verification

After updating:
- [ ] Test database connection works
- [ ] Test user login works
- [ ] Application starts without errors
- [ ] Production environment updated

See `CREDENTIAL_ROTATION_GUIDE.md` for detailed instructions.
