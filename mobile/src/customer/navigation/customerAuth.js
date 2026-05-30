export const navigateIfAuthenticated = (navigation, isAuthenticated, routeName, params) => {
  if (!isAuthenticated) {
    navigation.navigate('Login');
    return false;
  }
  navigation.navigate(routeName, params);
  return true;
};
