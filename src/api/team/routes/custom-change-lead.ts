export default {
  routes: [
    {
      method: "PUT",
      path: "/teams/:id/change-lead",
      handler: "team.changeLead",
      config: {},
    },
  ],
};
