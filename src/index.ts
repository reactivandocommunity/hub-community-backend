// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: any }) {
    // Set the reset password URL programmatically
    const pluginStore = strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({ key: "email" });
    const frontendUrl =
      process.env.FRONTEND_URL || "https://hubcommunity.io";

    if (settings && settings.reset_password) {
      // 1. Force update the response_url
      const resetPasswordUrl = `${frontendUrl}/reset-password`;
      settings.reset_password.options.response_url = resetPasswordUrl;

      // 2. Hardcode the URL in the message to be 100% sure it's not empty
      // We keep the <%= TOKEN %> which is correctly populated by Strapi
      settings.reset_password.options.message = `
<p>We heard that you lost your password. Sorry about that!</p>
<p>But don't worry! You can use the following link to reset your password:</p>
<p><a href="${resetPasswordUrl}?code=<%= TOKEN %>">${resetPasswordUrl}?code=<%= TOKEN %></a></p>
<p>Thanks.</p>`.trim();

      await pluginStore.set({ key: "email", value: settings });
      strapi.log.info(
        `Reset password configuration updated with hardcoded URL: ${resetPasswordUrl}`,
      );

      // Verify immediately
      const updatedSettings = await pluginStore.get({ key: "email" });
      strapi.log.info(
        "Verified reset_password options: " +
          JSON.stringify(updatedSettings.reset_password.options),
      );
    }
  },
};
