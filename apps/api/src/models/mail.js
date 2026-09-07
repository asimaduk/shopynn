// const sgMail = require('@sendgrid/mail');
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    // host: "smtp.ethereal.email",
    // port: 587,
    // secure: false, // true for 465, false for other ports
    auth: {
        user: "mail.asimadu@gmail.com",
        pass: process.env.GOOGLE_APP_PASSWORD,
    }
});

transporter.verify((err,status)=> {
    console.log(`Email verification status: ${status} | error: ${err ?? "No error"}`);
})

export const sendEmailService = async (data) => {
    // const msg = {
    //     to: 'asimaduk@gmail.com', // Change to your recipient
    //     from: 'mail.asimadu@gmail.com', // Change to your verified sender
    //     subject: 'Sending with SendGrid is Fun',
    //     text: 'and easy to do anywhere, even with Node.js',
    //     html: '<strong>and easy to do anywhere, even with Node.js</strong>',
    // }
    
    // const resp = await sgMail.send(msg);
    // console.log('resp is',resp);
    // return resp;
    // //   .then((response) => {
    // //     console.log(response[0].statusCode)
    // //     console.log(response[0].headers)
    // //   })
    // //   .catch((error) => {
    // //     console.error(error)
    // //   })

    const { sender_name, receipient, subject, title, message, bcc, text, html, attachments } = data;

    const mailOptions = {
        from: `"${sender_name}" <mail.asimadu@gmail.com>`,
        to: receipient,
        subject: subject,
        html: html ?? `<b>${title ?? ''}</b>\n<p>${message ?? ''}</p>`,
    };
    if (text) mailOptions.text = text;
    if (bcc) {
        mailOptions.bcc = bcc;
    }
    if (Array.isArray(attachments) && attachments.length > 0) {
        mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Message sent:", info.messageId);
    return info;
}