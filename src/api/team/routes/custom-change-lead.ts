export default {
  routes: [
    {
      method: "PUT",
      path: "/teams/:id/change-lead",
      handler: "team.changeLead",
      config: {},
    },
    {
      method: "POST",
      path: "/teams/:id/leave",
      handler: "team.leaveTeam",
      config: {},
    },
  ],
};
