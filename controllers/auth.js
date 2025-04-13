import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import cryptoRandomString from 'crypto-random-string';
import User from '../models/user.js';
import ResetToken from '../models/resetToken.js';
import Program from '../models/program.js';
import Subscription from '../models/subscription.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get file path for __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/* REGISTER */
export const register = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Hash the plain password with bcrypt
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new User({
            email,
            password: passwordHash,
            subscriptions: [] // Initialize subscriptions array
        });
        const savedUser = await newUser.save();
        
        // Create default personal program for the user
        const personalProgram = new Program({
            creator: savedUser._id,
            title: "Personal Tasks",
            description: "Your personal recurring tasks",
            category: "Personal",
            image: {
                path: '/public/assets/default-personal-program.jpg',
                filename: 'default-personal-program.jpg'
            },
            link: "",
            isPrivate: true,
            isPersonal: true // Special flag to identify this as the personal program
        });
        
        await personalProgram.save();
        
        // Create subscription to the personal program
        const personalSubscription = new Subscription({
            user: savedUser._id,
            program: personalProgram._id
        });
        await personalSubscription.save();
        
        // Add subscription to user
        savedUser.subscriptions.push(personalSubscription._id);
        await savedUser.save();
        
        res.status(201).json(savedUser);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong.", error: error });
    }
};

/* LOGIN */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email });

        if (!user) return res.status(404).json({ message: "User doesn't exist." });
        
        // Client is now sending SHA-256 hashed password, but our stored passwords use bcrypt
        // We need to revert to direct bcrypt comparison
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials." });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "12h" });
        delete user.password;
        res.status(200).json({ token, user });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong." });
    }
};

/* REQUEST PASSWORD RESET */
export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User with this email doesn't exist." });
        }
        
        // Delete any existing reset tokens for this user
        await ResetToken.deleteMany({ userId: user._id });
        
        // Generate new reset token - use a cryptographically secure random string
        const resetToken = cryptoRandomString({ length: 64, type: 'url-safe' });
        
        // Save token to database with 1 hour expiration
        const newResetToken = new ResetToken({
            userId: user._id,
            token: resetToken,
            createdAt: new Date()
        });
        await newResetToken.save();
        
        // Create reset URL
        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        
        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset',
            html: `
                <h1>Password Reset Request</h1>
                <p>You requested a password reset.</p>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.status(200).json({ message: "Password reset link sent to your email." });
    } catch (error) {
        console.error("Password reset request error:", error);
        res.status(500).json({ message: "Failed to send reset email." });
    }
};

/* RESET PASSWORD */
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        
        // Find valid reset token
        const resetToken = await ResetToken.findOne({ token });
        if (!resetToken) {
            return res.status(400).json({ message: "Invalid or expired reset token." });
        }
        
        // Check if token has expired (redundant with MongoDB TTL but adds extra security)
        const tokenCreationTime = resetToken.createdAt.getTime();
        const hourInMilliseconds = 60 * 60 * 1000;
        if (Date.now() > tokenCreationTime + hourInMilliseconds) {
            // Delete expired token
            await ResetToken.deleteOne({ _id: resetToken._id });
            return res.status(400).json({ message: "Reset token has expired. Please request a new one." });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Update user password
        await User.findByIdAndUpdate(
            resetToken.userId,
            { password: passwordHash }
        );
        
        // Delete used reset token to ensure one-time use
        await ResetToken.deleteOne({ _id: resetToken._id });
        
        res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ message: "Failed to reset password." });
    }
};
