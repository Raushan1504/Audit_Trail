import './LoadingState.css';

function LoadingState({ message = 'Replaying Event Store Stream...' }) {
  return (
    <div className="loading-state-3d">
      <div className="loading-state-3d__radar">
        <div className="loading-state-3d__ring loading-state-3d__ring--outer" />
        <div className="loading-state-3d__ring loading-state-3d__ring--middle" />
        <div className="loading-state-3d__ring loading-state-3d__ring--inner" />
        <div className="loading-state-3d__core" />
        <div className="loading-state-3d__sweep" />
      </div>
      <div className="loading-state-3d__info">
        <span className="loading-state-3d__title">{message}</span>
        <span className="loading-state-3d__sub">Querying MongoDB Append-Only Log & Executing Replay Fold</span>
      </div>
    </div>
  );
}

export default LoadingState;
