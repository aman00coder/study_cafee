import nodemailer from 'nodemailer';

export const sendOTP = async (email, otp) => {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  
    await transporter.sendMail({
      from: `"Study Cafe:" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email",
      html: `<h3>Your OTP is: <strong>${otp}</strong></h3>`,
    });
  };