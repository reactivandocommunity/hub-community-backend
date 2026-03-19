/**
 * voting-session controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::voting-session.voting-session', ({ strapi }) => ({
  async getResults(ctx) {
    const { sessionId } = ctx.params;

    // console.log(sessionId)

    // Find all votes for the given session ID and populate the voting_option relation using the core service
    const response = await strapi.service('api::vote.vote').find({
      filters: {
        voting_session: {
          documentId: sessionId,
        },
      },
      populate: ['voting_option', 'voting_session'],
    });

    // Extract results from the service response (which returns { results, pagination })
    const votes = response?.results || response || [];

    // console.log(votes)

    const voteCounts: Record<string, number> = {};
    const optionNames: Record<string, string> = {};

    for (const vote of votes) {
      if (vote.voting_option) {
        const optionId = vote.voting_option.id;
        const optionName = vote.voting_option.name;

        optionNames[optionId] = optionName;
        if (!voteCounts[optionId]) {
          voteCounts[optionId] = 0;
        }
        voteCounts[optionId]++;
      }
    }

    // Format the result to match the expected example JSON
    // [{ "option": "Startup A", "votes": 32 }]
    const result = Object.keys(voteCounts).map(optionId => ({
      option: optionNames[optionId],
      votes: voteCounts[optionId],
    }));

    return result.sort((a, b) => b.votes - a.votes);
  }
}));
