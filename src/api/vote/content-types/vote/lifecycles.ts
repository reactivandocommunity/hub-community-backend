import { errors } from '@strapi/utils';
const { ApplicationError } = errors;

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    
    // Extract fingerprint, ip_address, and voting_session
    const fingerprint = data.fingerprint;
    const ip_address = data.ip_address;
    
    // In Strapi v4+, relations might come as a single ID or an object/array depending on how it's sent.
    // E.g., data.voting_session = 1, or data.voting_session = { connect: [{ id: 1 }] }
    // In Strapi v5, relations often use documentId: data.voting_session = { connect: [{ documentId: 'abc' }] }
    let sessionId;
    if (typeof data.voting_session === 'number' || typeof data.voting_session === 'string') {
      sessionId = data.voting_session;
    } else if (data.voting_session?.connect?.length > 0) {
      sessionId = data.voting_session.connect[0].documentId || data.voting_session.connect[0].id;
    } else if (data.voting_session?.set?.length > 0) {
      sessionId = data.voting_session.set[0].documentId || data.voting_session.set[0].id;
    }

    if (!sessionId) {
      console.log('--- ERROR: Session extraction failed ---');
      console.log('Received voting_session:', JSON.stringify(data.voting_session, null, 2));
      throw new ApplicationError('Voting session is required');
    }

    if (!fingerprint) {
      throw new ApplicationError('Fingerprint is required to vote');
    }

    // Check if the voting_session is open
    const session = await strapi.documents('api::voting-session.voting-session').findOne({ documentId: sessionId });
    // Note: in Strapi 5, documentId is typically used instead of id for relations when querying `strapi.documents`
    // Wait, the client usually sends the documentId as the relation. So sessionId will be a documentId.
    
    if (!session) {
      // Let's fallback to finding by id if it's not documentId (in case of old usage with DB queries)
      const sessionById = await strapi.db.query('api::voting-session.voting-session').findOne({ where: { id: sessionId } });
      if (!sessionById || sessionById.status !== 'open') {
        throw new ApplicationError('This voting session is not open for voting');
      }
    } else if (session.status !== 'open') {
      throw new ApplicationError('This voting session is not open for voting');
    }

    // Check existing votes based ONLY on fingerprint to prevent blocking users on the same Wi-Fi
    const existingVote = await strapi.db.query('api::vote.vote').findOne({
      where: {
        voting_session: sessionId,
        fingerprint: fingerprint,
      }
    });

    if (existingVote) {
      throw new ApplicationError('You have already voted in this session.');
    }
  }
};
