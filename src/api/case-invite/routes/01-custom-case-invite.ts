export default {
  routes: [
    {
      method: 'POST',
      path: '/case-invites/accept',
      handler: 'api::case-invite.case-invite.accept',
      config: {
        policies: [],
      },
    },
  ],
};
