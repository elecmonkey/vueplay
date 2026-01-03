declare module "*.play.vue" {
  const component: {
    setup?: (...args: any[]) => any;
    render?: () => any;
  };
  export default component;
}
