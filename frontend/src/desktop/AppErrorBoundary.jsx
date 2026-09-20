import React from 'react';
import { ErrorState } from '../components/ui/ErrorState';

/** A crash inside one window shows an error in that window only; the desktop and every other app keep working. */
export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`${this.props.title} crashed:`, error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="p-6">
          <ErrorState
            title={`${this.props.title} stopped working`}
            message="Something went wrong in this window. The rest of the desktop is unaffected."
            onRetry={() => this.setState({ failed: false })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
