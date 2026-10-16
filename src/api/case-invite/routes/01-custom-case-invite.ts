export default {
  routes: [
    {
      method: 'POST',
      path: '/case-invites/accept',
      handler: 'case-invite.accept',
      config: {
        policies: [],
      },
    },
  ],
};
