import React, { useState, useEffect, useRef, useCallback } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Point, Polygon } from 'ol/geom';
import { Feature } from 'ol';
import { fromLonLat } from 'ol/proj';
import Modal from 'react-modal';
import { FaEllipsisV } from 'react-icons/fa';

const MapComponent = () => {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const [dropdownIndex, setDropdownIndex] = useState(null);
  const [selectedWaypoints, setSelectedWaypoints] = useState([]);

  useEffect(() => {
    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const initialMap = new Map({
      target: mapRef.current,
      layers: [new TileLayer({ source: new OSM() }), vectorLayer],
      view: new View({ center: fromLonLat([0, 0]), zoom: 4 }),
    });

    setMap(initialMap);
    return () => initialMap.setTarget(null);
  }, []);

  const calculateDistance = (coord1, coord2) => {
    const R = 6371;
    const dLat = (coord2[1] - coord1[1]) * (Math.PI / 180);
    const dLon = (coord2[0] - coord1[0]) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(coord1[1] * (Math.PI / 180)) * Math.cos(coord2[1] * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
  };

  const handleMapClick = useCallback((e) => {
    if (currentInteraction === 'waypoint') {
      const coords = e.coordinate;
      const pointFeature = new Feature({ geometry: new Point(coords) });
      map.getLayers().getArray()[1].getSource().addFeature(pointFeature);
      setWaypoints((prev) => [...prev, { lat: coords[1], lng: coords[0] }]);
    }
  }, [currentInteraction, map]);

  useEffect(() => {
    if (map) {
      map.on('click', handleMapClick);
    }
    return () => map?.un('click', handleMapClick);
  }, [map, handleMapClick]);

  const handleCheckboxChange = (index) => {
    setSelectedWaypoints((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const createPolygonFromWaypoints = (position) => {
    const vectorSource = map.getLayers().getArray()[1].getSource();
    let selectedCoords = selectedWaypoints.map((index) => [waypoints[index].lng, waypoints[index].lat]);

    if (selectedCoords.length >= 3) {
      if (position === 'before') {
        selectedCoords.unshift(selectedCoords[selectedCoords.length - 1]);
      } else {
        selectedCoords.push(selectedCoords[0]);
      }
      const polygonFeature = new Feature({ geometry: new Polygon([selectedCoords]) });
      vectorSource.addFeature(polygonFeature);
    }
  };

  const handlePolygonInsert = (position) => {
    createPolygonFromWaypoints(position);
    setDropdownIndex(null);
  };

  const resetCoordinates = () => {
    setWaypoints([]);
    map.getLayers().getArray()[1].getSource().clear();
    setSelectedWaypoints([]);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(waypoints, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'waypoints.json';
    link.click();
  };

  const modalData = waypoints.map((wp, i) => ({
    serialNumber: i + 1,
    coordinates: `${wp.lat}, ${wp.lng}`,
    distance: i > 0 ? calculateDistance([wp.lng, wp.lat], [waypoints[i - 1].lng, waypoints[i - 1].lat]) : 0,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: '20px' }}>
        <button style={styles.button} onClick={() => setCurrentInteraction('waypoint')}>Add Waypoint</button>
        <button style={styles.button} onClick={() => setIsModalOpen(true)}>Show Waypoints</button>
      </div>
      <div ref={mapRef} style={{ width: '100%', height: '800px' }}></div>
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        ariaHideApp={false}
        style={styles.modal}
      >
        <h2 style={{ textAlign: 'center' }}>Coordinates</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Select</th>
              <th>Node Point</th>
              <th>Coordinates</th>
              <th>Distance (KM)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {modalData.map((data, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedWaypoints.includes(i)}
                    onChange={() => handleCheckboxChange(i)}
                  />
                </td>
                <td>{data.serialNumber}</td>
                <td>{data.coordinates}</td>
                <td>{data.distance}</td>
                <td style={{ position: 'relative' }}>
                  <FaEllipsisV onClick={() => setDropdownIndex(dropdownIndex === i ? null : i)} />
                  {dropdownIndex === i && (
                    <div
                      style={{
                        ...styles.dropdown,
                        left: '100%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <div onClick={() => handlePolygonInsert('before')}>Insert Polygon Before</div>
                      <div onClick={() => handlePolygonInsert('after')}>Insert Polygon After</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={styles.buttonContainer}>
          <button style={styles.button} onClick={resetCoordinates}>
            Reset
          </button>
          <button style={styles.databutton} onClick={exportData}>
            Generate Data
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MapComponent;
const styles = {
  table: {
    width: '90%',
    borderCollapse: 'collapse',
    borderRadius: '10px',
    backgroundColor: '#fefefe',
    tableLayout: 'auto',
    margin: '0 auto',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    zIndex: 1,
    cursor: 'pointer',
    width: '180px',
    borderRadius: '5px',
    padding: '5px',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '180px',
  },
  modal: {
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    content: {
      padding: '20px',
      borderRadius: '10px',
      width: '80%',
      maxWidth: '1000px',
      margin: 'auto',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      maxHeight: '50vh', 
      overflowY: 'auto', 
    },
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    // marginTop: '20px',
    paddingRight: '40px',
    paddingLeft: '40px',
    marginTop: '40px',
    alignItems: 'flex-end',
  },
  databutton: {
    padding: '10px 20px',
    borderRadius: '5px',
    border: '1px solid #000000',
    backgroundColor: 'green',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  button:{
    padding: '10px 20px',
    borderRadius: '5px',
    border: '1px solid #000000',
    backgroundColor: '#007BFF',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  buttonHover: {
    backgroundColor: '#0056b3',
  },
  scrollableBody: {
    maxHeight: '300px',  
    overflowY: 'auto',   
    display: 'block',    
    msOverflowStyle: 'none', 
    scrollbarWidth: 'none', 
  },
};



