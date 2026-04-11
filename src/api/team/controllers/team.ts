/**
 * team controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::team.team', ({ strapi }) => ({
  async find(ctx) {
    const response = await super.find(ctx);

    // Strapi 5 doesn't populate users-permissions relations via REST params.
    // Manually populate lead and members for each team.
    if (response.data) {
      for (const team of response.data) {
        const full = await strapi.documents('api::team.team').findFirst({
          filters: { documentId: team.documentId },
          populate: { lead: { fields: ['id', 'name', 'username'] }, members: { fields: ['id', 'name', 'username'] } },
        });
        if (full) {
          team.lead = full.lead;
          team.members = full.members;
        }
      }
    }

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (response.data) {
      const full = await strapi.documents('api::team.team').findFirst({
        filters: { documentId: response.data.documentId },
        populate: { lead: { fields: ['id', 'name', 'username'] }, members: { fields: ['id', 'name', 'username'] } },
      });
      if (full) {
        response.data.lead = full.lead;
        response.data.members = full.members;
      }
    }

    return response;
  },

  async create(ctx) {
    const response = await super.create(ctx);

    const user = ctx.state.user;
    if (user && response.data?.documentId) {
      await strapi.service('api::team.team').update(response.data.documentId, {
        data: { lead: user.id },
      });
    }

    return response;
  },

  async changeLead(ctx) {
    const { id: teamDocumentId } = ctx.params;
    const { newLeadId } = ctx.request.body;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Você precisa estar autenticado.');
    }

    if (!newLeadId) {
      return ctx.badRequest('newLeadId é obrigatório.');
    }

    // Fetch team with lead and members populated
    const teams = await strapi.documents('api::team.team').findMany({
      filters: { documentId: teamDocumentId },
      populate: ['lead', 'members'],
      limit: 1,
    });

    const team = teams?.[0];
    if (!team) {
      return ctx.notFound('Time não encontrado.');
    }

    // Only the current lead can change lead
    if (team.lead?.id !== user.id) {
      return ctx.forbidden('Apenas o líder pode transferir a liderança.');
    }

    // Verify new lead is a member
    const isMember = team.members?.some((m: any) => m.id === newLeadId);
    if (!isMember) {
      return ctx.badRequest('O novo líder precisa ser membro do time.');
    }

    await strapi.service('api::team.team').update(teamDocumentId, {
      data: { lead: newLeadId },
    });

    return { data: { success: true } };
  },
}));
