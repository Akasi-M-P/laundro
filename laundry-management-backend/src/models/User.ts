import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
  EMPLOYEE = 'EMPLOYEE'
}

export interface IUser extends Document {
  shopId?: mongoose.Types.ObjectId; // Admin has no shopId
  name: string;
  email?: string; // Optional for Employee (uses phone/username + OTP conceptually)
  passwordHash?: string; // For Admin/Owner
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
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
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  if (this.passwordHash) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

export default mongoose.model<IUser>('User', UserSchema);
