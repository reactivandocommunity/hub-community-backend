/**
 * vote controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::vote.vote', ({ strapi }) => ({
  async create(ctx) {
    // Inject IP address from the request into the body
    const ip = ctx.request.ip;

    if (ctx.request.body && ctx.request.body.data) {
      ctx.request.body.data.ip_address = ip;
    }

    console.log(ctx.request.body)

    // Call the default core action
    const response = await super.create(ctx);
    return response;
  }
}));
