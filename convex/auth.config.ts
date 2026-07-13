import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Email({
      authorize: undefined,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const { error } = await resend.emails.send({
          from: "StickThemAnywhere <onboarding@resend.dev>",
          to: email,
          subject: "Sign in to Admin Dugout",
          html: `
            <div style="font-family:monospace;background:#000;color:#00ff41;padding:32px;max-width:480px;">
              <h2 style="color:#00ff41;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:24px;">
                Admin Dugout — Magic Link
              </h2>
              <p style="color:#aaa;margin-bottom:24px;">
                Click the link below to sign in. This link expires in 15 minutes.
              </p>
              <a href="${url}"
                style="display:inline-block;padding:12px 24px;background:#00ff41;color:#000;font-weight:bold;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;">
                SIGN IN
              </a>
              <p style="color:#555;margin-top:24px;font-size:12px;">
                Or paste this URL: ${url}
              </p>
            </div>
          `,
        });
        if (error) {
          throw new Error(`Resend error: ${error.message}`);
        }
      },
    }),
  ],
});
