function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shipment/:shipmentId" element={<ShipmentDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;