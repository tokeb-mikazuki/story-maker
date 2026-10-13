// 화면을 그리다 예외가 나도 앱 전체가 흰 화면으로 굳지 않게 막는 안전망.
// 다른 화면으로 옮기면(resetKey가 바뀌면) 자동으로 다시 그리고, 같은 화면에서는 직접 다시 시도할 수 있다.

import { Component, type ReactNode } from 'react';

interface Props {
  /** 바뀌면 오류 상태를 풀고 다시 그린다(주소 등) */
  resetKey: string;
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('화면 오류:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: undefined });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="auth-page">
        <div className="auth-card" role="alert">
          <h1>화면을 불러오지 못했어요</h1>
          <p className="auth-sub">잠깐 문제가 생겼어요. 다시 시도하거나 처음 화면으로 돌아가 보세요.</p>
          <button className="btn primary big" onClick={() => this.setState({ error: undefined })}>
            다시 시도
          </button>
          <div className="auth-foot">
            <a href="#/">처음으로</a>
            <span>·</span>
            <button className="link" onClick={() => window.location.reload()}>
              새로고침
            </button>
          </div>
          <p className="dev-note">{String(error.message).slice(0, 200)}</p>
        </div>
      </div>
    );
  }
}
