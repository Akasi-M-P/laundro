# Credential Rotation Guide

## 🔐 Security Credential Rotation Instructions

This guide will help you rotate the exposed credentials that were previously committed to version control.

---

## 1. MongoDB Database Password Rotation

### For MongoDB Atlas (Cloud):

1. **Log in to MongoDB Atlas:**
   - Go to https://cloud.mongodb.com
   - Sign in with your account

2. **Navigate to Database Access:**
   - Click "Database Access" in the left sidebar
   - Find the user: `mbajameel90_db_user`

3. **Change Password:**
   - Click "Edit" next to the user
   - Click "Edit Password"
   - Generate a new strong password (or create your own)
   - **Save the new password securely** (you'll need it for step 4)
   - Click "Update User"

4. **Update Connection String:**
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the new connection string
   - Replace the password in the connection string with your new password
   - Format: `mongodb+srv://mbajameel90_db_user:NEW_PASSWORD@cluster0.9bx2li8.mongodb.net/laundro?retryWrites=true&w=majority&appName=Cluster0`

5. **Update Local config.env:**
   ```env
   MONGO_URI=mongodb+srv://mbajameel90_db_user:YOUR_NEW_PASSWORD@cluster0.9bx2li8.mongodb.net/laundro?retryWrites=true&w=majority&appName=Cluster0
   ```

6. **Update Production Environment:**
   - Update the `MONGO_URI` environment variable in your production hosting platform
   - Restart your application after updating

### For Self-Hosted MongoDB:

1. Connect to your MongoDB server
2. Run: `db.changeUserPassword("mbajameel90_db_user", "NEW_STRONG_PASSWORD")`
3. Update connection strings in all environments

---

## 2. Generate New JWT_SECRET

✅ **A new JWT_SECRET has been generated for you:**

```env
JWT_SECRET=4da24162e273cbdbd1d3910e44a386d77b3a67d5b599b8f289384c50c9c7dc1d
```

**Add this to your `config.env` file:**
```env
JWT_SECRET=4da24162e273cbdbd1d3910e44a386d77b3a67d5b599b8f289384c50c9c7dc1d
```

**Important:** 
- The JWT_SECRET must be at least 32 characters long
- Keep it secret and never commit it to version control
- Use different secrets for development and production

### To Generate Your Own (Optional):

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using OpenSSL:**
```bash
openssl rand -hex 32
```

**Using Online Generator:**
- Visit: https://randomkeygen.com/
- Use "CodeIgniter Encryption Keys" (256-bit)

---

## 3. Update Production Environment Variables

### For Different Hosting Platforms:

#### **Heroku:**
```bash
heroku config:set MONGO_URI="your_new_connection_string" --app your-app-name
heroku config:set JWT_SECRET="your_new_jwt_secret" --app your-app-name
heroku restart --app your-app-name
```

#### **AWS (Elastic Beanstalk):**
1. Go to AWS Console → Elastic Beanstalk
2. Select your environment
3. Go to "Configuration" → "Software"
4. Add environment properties:
   - `MONGO_URI` = your new connection string
   - `JWT_SECRET` = your new JWT secret
5. Apply changes and restart

#### **AWS (EC2/ECS):**
- Update environment variables in your task definition or EC2 user data
- Restart services

#### **DigitalOcean App Platform:**
1. Go to your app settings
2. Navigate to "App-Level Environment Variables"
3. Update `MONGO_URI` and `JWT_SECRET`
4. Redeploy the app

#### **Docker:**
Update your `docker-compose.yml` or `.env` file:
```yaml
environment:
  - MONGO_URI=your_new_connection_string
  - JWT_SECRET=your_new_jwt_secret
```
Then restart: `docker-compose up -d`

#### **Kubernetes:**
Update your secrets:
```bash
kubectl create secret generic app-secrets \
  --from-literal=MONGO_URI='your_new_connection_string' \
  --from-literal=JWT_SECRET='your_new_jwt_secret' \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### **Environment File (.env):**
If using environment files directly:
1. Update `.env` or `config.env` on your server
2. Restart your application

---

## 4. Verification Checklist

After updating credentials:

- [ ] MongoDB password changed in database
- [ ] New connection string tested locally
- [ ] `config.env` updated with new credentials (local only)
- [ ] Production `MONGO_URI` updated
- [ ] Production `JWT_SECRET` updated
- [ ] Application restarted in production
- [ ] Test login/authentication works
- [ ] Test database connection works
- [ ] Old credentials are no longer in use anywhere

---

## 5. Important Notes

⚠️ **Security Best Practices:**

1. **Never commit credentials** to version control
2. **Use different secrets** for development and production
3. **Rotate credentials regularly** (every 90 days recommended)
4. **Use secrets management** services in production:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager

5. **After rotation:**
   - All existing JWT tokens will be invalid (users need to re-login)
   - Monitor for any connection issues
   - Keep old credentials for 24-48 hours as backup, then delete

---

## 6. Troubleshooting

**Connection Issues:**
- Verify the new password is correct
- Check IP whitelist in MongoDB Atlas
- Ensure connection string format is correct

**Authentication Errors:**
- Old JWT tokens will fail - users need to re-login
- Clear browser localStorage/sessionStorage if needed

**Application Won't Start:**
- Verify environment variables are set correctly
- Check logs for specific error messages
- Ensure JWT_SECRET is at least 32 characters

---

## Need Help?

If you encounter issues:
1. Check application logs
2. Verify environment variables are loaded correctly
3. Test database connection separately
4. Review MongoDB Atlas connection logs
