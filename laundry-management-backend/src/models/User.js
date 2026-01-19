const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UserRole = {
  ADMIN: 'ADMIN',
  OWNER: 'OWNER',
  EMPLOYEE: 'EMPLOYEE'
};

const UserSchema = new Schema({
  shopId: { type: Schema.Types.ObjectId, ref: 'Shop' },
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true, lowercase: true },
  passwordHash: { type: String, select: false }, // Don't return by default
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    required: true 
  },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  if (this.passwordHash) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Indexes for user queries
UserSchema.index({ shopId: 1, role: 1 }); // Find employees/owners by shop
UserSchema.index({ email: 1 }); // Login lookups (unique index already exists, but explicit is good)
UserSchema.index({ shopId: 1, isActive: 1 }); // Active users by shop

const User = mongoose.model('User', UserSchema);
module.exports = User;
module.exports.UserRole = UserRole;
