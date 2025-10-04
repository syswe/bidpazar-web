import 'react';

declare module 'react' {
  interface ExoticComponent<P = {}> {
    (props: P): React.ReactNode | Promise<React.ReactNode>;
  }
}
