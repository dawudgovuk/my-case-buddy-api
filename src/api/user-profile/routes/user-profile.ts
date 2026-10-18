export default {
  routes: [
    {
      method: 'GET',
      path: '/user-profile',
      handler: 'user-profile.getProfile',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/user-profile',
      handler: 'user-profile.updateProfile',
      config: {
        auth: false,
      },
    },
  ],
};
