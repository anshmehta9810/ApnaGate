import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; 
import './App.css';

const API_BASE_URL = 'http://127.0.0.1:5000'; 
const SOCKET_URL = 'http://127.0.0.1:5000'; 

function App() {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [residentFlat, setResidentFlat] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [sosAlert, setSosAlert] = useState(null); // e.g., { flat_number: 'B2-101' }

  //Socket.IO connection
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to real-time server!');
    });

    //sos_alert
    socket.on('sos_alert', (data) => {
      console.log('SOS Alert Received:', data);
      setSosAlert(data); // Show the alert
 
      setTimeout(() => {
        setSosAlert(null);
      }, 15000);
    });

        return () => {
      socket.disconnect();
    };
  }, []); 

  //Vehicle check
  const handleCheckVehicle = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setApiResponse(null);
    setError('');
    setMessage('');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/gate/check-vehicle`, {
        vehicle_number: vehicleNumber
      });
      setApiResponse(response.data);
    } catch (err) {
      setError('Failed to connect to the server or invalid vehicle number.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  //Generate PIN
  const handleGeneratePin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/gate/generate-pin`, {
        visitor_phone_number: visitorPhone,
        resident_flat_number: residentFlat,
      });
      setMessage(response.data.message); // "PIN Generated..."
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  //Verify PIN
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/gate/verify-pin`, {
        pin_code: pin,
        resident_flat_number: residentFlat,
      });
      setMessage(response.data.message); // "ACCESS GRANTED"
      setApiResponse(null); // Reset the state after success
    } catch (err) {
      setError(err.response?.data?.error || 'PIN verification failed.');
    } finally {
      setIsLoading(false);
    }
  };
  
  //Reset
  const handleReset = () => {
    setVehicleNumber('');
    setApiResponse(null);
    setError('');
    setVisitorPhone('');
    setResidentFlat('');
    setPin('');
    setMessage('');
  };

  return (
    <div className="container">
      {/* --- NEW: SOS Alert Popup --- */}
      {sosAlert && (
        <div className="sos-alert-popup">
          <h2>EMERGENCY SOS!</h2>
          <p>Alert from Flat: <strong>{sosAlert.flat_number}</strong></p>
	  <p>Phone: <strong>{sosAlert.phone_number}</strong></p>
          <button onClick={() => setSosAlert(null)}>Dismiss</button>
        </div>
      )}

      <h1>ApnaGate - Guard Portal</h1>
      
      {!apiResponse && !message.includes('ACCESS GRANTED') && (
        <form onSubmit={handleCheckVehicle} className="form-section">
          <input
            type="text"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            placeholder="Enter Vehicle Number"
            required
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Check Vehicle'}
          </button>
        </form>
      )}

      {error && (
        <div className="error-section">
          <p className="error-message">{error}</p>
          <button onClick={handleReset} className="reset-button">
            Check New Vehicle
          </button>
        </div>
      )}

      {apiResponse && (
        <div className="response-section">
          {apiResponse.status === 'Resident' && (
            <div className="result-approved">
              <h2>ACCESS APPROVED</h2>
              <p><strong>Vehicle Owner:</strong> {apiResponse.details.name}</p>
              <p><strong>Flat:</strong> {apiResponse.details.flat_number}</p>
              <button onClick={handleReset}>Next Vehicle</button>
            </div>
          )}

          {apiResponse.status === 'Visitor' && !message && (
            <div className="result-visitor">
              <h2>VISITOR!!</h2>
              <p>This vehicle is not registered. Please enter visitor details.</p>
              <form onSubmit={handleGeneratePin} className="form-section">
                <input
                  type="text"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  placeholder="Visitor's Phone Number"
                  required
                />
                <input
                  type="text"
                  value={residentFlat}
                  onChange={(e) => setResidentFlat(e.target.value.toUpperCase())}
                  placeholder="Resident's Flat (e.g., B2-101)"
                  required
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? 'Generating...' : 'Generate PIN'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
      
      {message && apiResponse?.status === 'Visitor' && !message.includes('ACCESS GRANTED') && (
        <div className="response-section">
          <p className="message">{message}</p>
          <form onSubmit={handleVerifyPin} className="form-section">
             <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-Digit PIN"
                required
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify PIN'}
              </button>
          </form>
        </div>
      )}
      
      {message && message.includes('ACCESS GRANTED') && (
        <div className="result-approved">
            <h2>{message}</h2>
            <button onClick={handleReset}>Next Vehicle</button>
        </div>
      )}
    </div>
  );
}

export default App;