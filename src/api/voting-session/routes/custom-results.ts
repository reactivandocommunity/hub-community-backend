export default {
  routes: [
    {
      method: "GET",
      path: "/voting/results/:sessionId",
      handler: "voting-session.getResults",
      config: {
        auth: false,
      },
    },
  ],
};
