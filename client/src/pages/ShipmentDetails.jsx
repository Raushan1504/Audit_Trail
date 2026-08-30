import { useParams, Link } from 'react-router-dom';

function ShipmentDetails() {
  const { shipmentId } = useParams();

  return (
    <div className="shipment-details">
      <Link to="/">&larr; Back to Search</Link>
      <h2>Shipment Details</h2>
      <p>Shipment ID: <strong>{shipmentId}</strong></p>
      <p>Current State: <em>Coming soon (Day 4)</em></p>
      <p>Version: <em>Coming soon (Day 4)</em></p>
    </div>
  );
}

export default ShipmentDetails;