/**
 * team controller
 */

import { factories } from '@strapi/strapi';

// Helper: populate lead and members via db.query (bypasses REST sanitization
// of plugin::users-permissions.user relations)
async function populateTeamUsers(strapi: any, team: any) {
  const raw = await strapi.db.query('api::team.team').findOne({
    where: { documentId: team.documentId },
    populate: { lead: true, members: true, event: true },
  });

  if (raw?.lead) {
    team.lead = { id: raw.lead.id, name: raw.lead.name, username: raw.lead.username };
  }
  if (raw?.members) {
    team.members = raw.members.map((m: any) => ({ id: m.id, name: m.name, username: m.username }));
  }
  if (raw?.event) {
    team.event = { id: raw.event.id, documentId: raw.event.documentId, title: raw.event.title };
  }
}

export default factories.createCoreController('api::team.team', ({ strapi }) => ({
  async find(ctx) {
    const response = await super.find(ctx);

    if (response.data) {
      for (const team of response.data) {
        await populateTeamUsers(strapi, team);
      }
    }

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (response.data) {
      await populateTeamUsers(strapi, response.data);
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

    // Fetch team with lead and members via db.query
    const team = await strapi.db.query('api::team.team').findOne({
      where: { documentId: teamDocumentId },
      populate: { lead: true, members: true },
    });

    if (!team) {
      return ctx.notFound('Time não encontrado.');
    }

    if (team.lead?.id !== user.id) {
      return ctx.forbidden('Apenas o líder pode transferir a liderança.');
    }

    const isMember = team.members?.some((m: any) => m.id === newLeadId);
    if (!isMember) {
      return ctx.badRequest('O novo líder precisa ser membro do time.');
    }

    await strapi.service('api::team.team').update(teamDocumentId, {
      data: { lead: newLeadId },
    });

    return { data: { success: true } };
  },

  async leaveTeam(ctx) {
    const { id: teamDocumentId } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Você precisa estar autenticado.');
    }

    // Fetch team with lead and members
    const team = await strapi.db.query('api::team.team').findOne({
      where: { documentId: teamDocumentId },
      populate: { lead: true, members: true },
    });

    if (!team) {
      return ctx.notFound('Time não encontrado.');
    }

    const isMember = team.members?.some((m: any) => m.id === user.id);
    if (!isMember) {
      return ctx.badRequest('Você não é membro deste time.');
    }

    // Remove user from team
    await strapi.plugin('users-permissions').service('user').edit(user.id, { team: null });

    // Check remaining members (exclude the leaving user)
    const remainingMembers = (team.members || []).filter((m: any) => m.id !== user.id);

    if (remainingMembers.length === 0) {
      // No members left — delete the team
      await strapi.service('api::team.team').delete(teamDocumentId);
      return { data: { deleted: true } };
    }

    // If the leaving user was the lead, assign a random remaining member
    if (team.lead?.id === user.id) {
      const randomIndex = Math.floor(Math.random() * remainingMembers.length);
      const newLead = remainingMembers[randomIndex];
      await strapi.service('api::team.team').update(teamDocumentId, {
        data: { lead: newLead.id },
      });
    }

    return { data: { deleted: false } };
  },

  async uploadPresentation(ctx) {
    const { id: teamDocumentId } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Você precisa estar autenticado.');
    }

    const files = ctx.request.files as any;
    if (!files || !files.file) {
      return ctx.badRequest('Nenhum arquivo enviado. Envie no campo "file".');
    }

    const team = await strapi.db.query('api::team.team').findOne({
      where: { documentId: teamDocumentId },
      populate: { members: true },
    });

    if (!team) {
      return ctx.notFound('Time não encontrado.');
    }

    const isMember = team.members?.some((m: any) => m.id === user.id);
    if (!isMember) {
      return ctx.forbidden('Você não é membro deste time para enviar a apresentação.');
    }

    const uploadService = strapi.plugin('upload').service('upload');

    try {
      await uploadService.uploadToEntity(
        {
          id: team.id,
          model: 'api::team.team',
          field: 'presentation',
        },
        files.file
      );

      return { data: { success: true } };
    } catch (err) {
      console.error('Upload Error:', err);
      return ctx.internalServerError('Erro ao fazer upload da apresentação.');
    }
  },
}));
