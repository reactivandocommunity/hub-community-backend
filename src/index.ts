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
    // Grant public permissions for voting
    try {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      if (publicRole) {
        // Permissions to grant
        const permissionsToGrant = [
          'api::voting-session.voting-session.find',
          'api::voting-session.voting-session.findOne',
          'api::voting-session.voting-session.getResults',
          'api::voting-option.voting-option.find',
          'api::voting-option.voting-option.findOne',
          'api::vote.vote.create',
        ];

        for (const action of permissionsToGrant) {
          const existingPermission = await strapi.db.query('plugin::users-permissions.permission').findOne({
            where: {
              role: publicRole.id,
              action: action,
            },
          });

          if (!existingPermission) {
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: {
                role: publicRole.id,
                action: action,
              },
            });
            strapi.log.info(`Granted public permission: ${action}`);
          }
        }
      }
    } catch (err) {
      strapi.log.error('Failed to bootstrap voting permissions: ' + err.message);
    }

    // Add indexes for Performance Considerations (session_id, option_id, fingerprint)
    try {
      const knex = strapi.db.connection;
      const tableExists = await knex.schema.hasTable('votes');
      if (tableExists) {
        // Fingerprint index
        await knex.schema.alterTable('votes', (table) => {
          table.index(['fingerprint'], 'idx_vote_fingerprint').catch(() => {});
        }).catch(() => {});
        
        // Relation indexes (Strapi might create these automatically, but we ensure them here)
        // Note: Strapi usually names foreign keys as <relation_name>_id
        await knex.schema.alterTable('votes', (table) => {
          table.index(['voting_session_id'], 'idx_vote_session').catch(() => {});
        }).catch(() => {});

        await knex.schema.alterTable('votes', (table) => {
          table.index(['voting_option_id'], 'idx_vote_option').catch(() => {});
        }).catch(() => {});
        
        strapi.log.info('Voting performance indexes ensured');
      }
    } catch (err) {
      strapi.log.warn('Could not define custom performance indexes, they might exist or table not ready: ' + err.message);
    }

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
