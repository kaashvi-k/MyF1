import { resend } from "./resend.js";

export default async function handler(req, res) {
  try {
    const data = await resend.emails.send({
      from: "ApexF1 <onboarding@resend.dev>",
      to: ["kaashvikakkar@gmail.com"],
      subject: "Testing Resend",
      html: "<h1>Hello!</h1>",
    });

    console.log(data);

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
}