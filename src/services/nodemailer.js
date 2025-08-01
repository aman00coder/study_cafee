import nodemailer from 'nodemailer';

export const sendOTP = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false // for local testing only
            }
        });

        const mailOptions = {
            from: `"Study Cafe" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your Verification OTP",
            text: `Your OTP is: ${otp}\nThis OTP is valid for 10 minutes.`,
            html: `<p>Your OTP is: <strong>${otp}</strong></p>
                   <p>This OTP is valid for 10 minutes.</p>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error(`Failed to send OTP: ${error.message}`);
    }
};