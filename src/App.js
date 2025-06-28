import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const TimeSlot = ({ time, event, onEventChange, formatTimeDisplay }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleEventClick = () => {
    setIsEditing(true);
  };

  const handleInputChange = (e) => {
    onEventChange(e.target.value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
  };

  return (
    <div className="time-slot">
      <div className="time" title={`${time} (24-hour)`}>
        {formatTimeDisplay(time)}
      </div>
      <div className="event" onClick={handleEventClick}>
        {isEditing ? (
          <input
            type="text"
            value={event}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            autoFocus
          />
        ) : (
          <span>{event}</span>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [events, setEvents] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const recognitionRef = useRef(null);

  // Load events from localStorage on component mount
  useEffect(() => {
    const savedEvents = localStorage.getItem('calendarEvents');
    if (savedEvents) {
      try {
        setEvents(JSON.parse(savedEvents));
      } catch (error) {
        console.error('Error loading events from localStorage:', error);
      }
    }
  }, []);

  // Save events to localStorage whenever events change
  useEffect(() => {
    localStorage.setItem('calendarEvents', JSON.stringify(events));
  }, [events]);

  const hours = Array.from({ length: 37 }, (_, i) => {
    const hour = Math.floor(i / 2) + 5; // Start from 5 AM
    const minute = i % 2 === 0 ? '00' : '30';
    const h = hour < 10 ? `0${hour}` : hour;
    return `${h}:${minute}`;
  });

  const formatTimeDisplay = useCallback((time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }, []);

  const showFeedback = useCallback((message, type = 'info') => {
    // Create a temporary feedback element
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = `voice-feedback ${type}`;
    feedbackDiv.textContent = message;
    feedbackDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      max-width: 400px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'success') {
      feedbackDiv.style.backgroundColor = '#4caf50';
    } else if (type === 'error') {
      feedbackDiv.style.backgroundColor = '#f44336';
    } else {
      feedbackDiv.style.backgroundColor = '#2196f3';
    }
    
    document.body.appendChild(feedbackDiv);
    
    // Remove after 4 seconds
    setTimeout(() => {
      if (feedbackDiv.parentNode) {
        feedbackDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (feedbackDiv.parentNode) {
            feedbackDiv.parentNode.removeChild(feedbackDiv);
          }
        }, 300);
      }
    }, 4000);
  }, []);

  const findClosestTimeSlot = useCallback((targetTime) => {
    const [targetHour, targetMinute] = targetTime.split(':').map(Number);
    const targetMinutes = targetHour * 60 + targetMinute;
    
    let closestTime = null;
    let minDifference = Infinity;
    
    hours.forEach(timeSlot => {
      const [slotHour, slotMinute] = timeSlot.split(':').map(Number);
      const slotMinutes = slotHour * 60 + slotMinute;
      const difference = Math.abs(targetMinutes - slotMinutes);
      
      if (difference < minDifference) {
        minDifference = difference;
        closestTime = timeSlot;
      }
    });
    
    // Only return if within 30 minutes
    return minDifference <= 30 ? closestTime : null;
  }, [hours]);

  const parseTime = useCallback((timeStr) => {
    // Handle various time formats more robustly
    const cleanTimeStr = timeStr.replace(/\s+/g, '').toLowerCase();
    
    // Handle "o'clock" format
    let processedTimeStr = cleanTimeStr.replace(/o'clock?/g, ':00');
    
    // Extract time and period with case-insensitive regex
    let [time, period] = processedTimeStr.split(/(am|pm)/);
    if (!time) return null;

    let [parsedHours, parsedMinutes] = time.split(':');
    parsedHours = parseInt(parsedHours, 10);
    parsedMinutes = parsedMinutes ? parseInt(parsedMinutes, 10) : 0;

    if (isNaN(parsedHours) || isNaN(parsedMinutes)) return null;

    // Handle AM/PM conversion
    if (period) {
      if (period === 'pm' && parsedHours < 12) {
        parsedHours += 12;
      } else if (period === 'am' && parsedHours === 12) {
        parsedHours = 0;
      }
    }

    // Validate hours and minutes
    if (parsedHours < 0 || parsedHours > 23 || parsedMinutes < 0 || parsedMinutes > 59) {
      return null;
    }

    const formattedHours = parsedHours < 10 ? `0${parsedHours}` : `${parsedHours}`;
    const formattedMinutes = parsedMinutes < 10 ? `0${parsedMinutes}` : `${parsedMinutes}`;
    const finalTime = `${formattedHours}:${formattedMinutes}`;

    // Check if time is in available slots, if not, find closest slot
    if (hours.includes(finalTime)) {
      return finalTime;
    }
    
    // Find closest available time slot
    const closestTime = findClosestTimeSlot(finalTime);
    if (closestTime) {
      console.log(`Time '${finalTime}' mapped to closest slot: ${closestTime}`);
      return closestTime;
    }
    
    console.log(`Time '${finalTime}' not found in available slots.`);
    return null;
  }, [hours, findClosestTimeSlot]);

  const findEventByName = useCallback((eventName) => {
    const searchTerm = eventName.toLowerCase();
    for (const [time, event] of Object.entries(events)) {
      if (event.toLowerCase().includes(searchTerm)) {
        return time;
      }
    }
    return null;
  }, [events]);

  const cancelEvent = useCallback((time) => {
    const eventName = events[time];
    setEvents(prev => {
      const newEvents = { ...prev };
      delete newEvents[time];
      return newEvents;
    });
    showFeedback(`🗑️ Cancelled: "${eventName}" at ${formatTimeDisplay(time)}`, 'success');
  }, [events, formatTimeDisplay, showFeedback]);

  const rescheduleEvent = useCallback((oldTime, newTime) => {
    const eventName = events[oldTime];
    
    // Check if new time is already occupied
    if (events[newTime]) {
      showFeedback(`⚠️ There's already an event at ${formatTimeDisplay(newTime)}. Please choose a different time.`, 'error');
      return;
    }
    
    setEvents(prev => {
      const newEvents = { ...prev };
      delete newEvents[oldTime];
      newEvents[newTime] = eventName;
      return newEvents;
    });
    
    showFeedback(`🔄 Rescheduled: "${eventName}" from ${formatTimeDisplay(oldTime)} to ${formatTimeDisplay(newTime)}`, 'success');
  }, [events, formatTimeDisplay, showFeedback]);

  const processVoiceCommand = useCallback((command) => {
    console.log(`Processing voice command: "${command}"`);
    
    // Check for cancel/delete commands first
    const cancelPatterns = [
      /(?:cancel|delete|remove)\s+(.+?)\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?)/i,
      /(?:cancel|delete|remove)\s+(.+)/i,
      /(?:cancel|delete|remove)\s+(?:the\s+)?(?:event\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m?)/i
    ];

    for (const pattern of cancelPatterns) {
      const match = command.match(pattern);
      if (match) {
        if (match[2]) {
          // "cancel meeting at 3pm"
          const eventText = match[1].trim();
          const timeStr = match[2].trim();
          const time = parseTime(timeStr);
          if (time && events[time] && events[time].toLowerCase().includes(eventText.toLowerCase())) {
            cancelEvent(time);
            return;
          }
        } else if (match[1]) {
          // "cancel meeting" or "cancel 3pm"
          const target = match[1].trim();
          const time = parseTime(target);
          if (time && events[time]) {
            cancelEvent(time);
            return;
          } else {
            // Try to find event by name
            const foundTime = findEventByName(target);
            if (foundTime) {
              cancelEvent(foundTime);
              return;
            }
          }
        }
      }
    }

    // Check for reschedule commands
    const reschedulePatterns = [
      /(?:reschedule|move|change)\s+(.+?)\s+(?:from\s+)?(?:\d{1,2}(?::\d{2})?\s*[ap]m?)?\s+(?:to|at)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?)/i,
      /(?:reschedule|move|change)\s+(.+?)\s+(?:to|at)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?)/i
    ];

    for (const pattern of reschedulePatterns) {
      const match = command.match(pattern);
      if (match) {
        const eventText = match[1].trim();
        const newTimeStr = match[2].trim();
        const newTime = parseTime(newTimeStr);
        
        if (newTime) {
          const foundTime = findEventByName(eventText);
          if (foundTime) {
            rescheduleEvent(foundTime, newTime);
            return;
          } else {
            showFeedback(`❌ Could not find event: "${eventText}"`, 'error');
            return;
          }
        } else {
          showFeedback(`❌ Invalid new time: "${newTimeStr}"`, 'error');
          return;
        }
      }
    }
    
    // Multiple regex patterns for different command formats (existing scheduling)
    const patterns = [
      // "schedule meeting at 3pm"
      /(?:schedule|add|book|create)\s+(.+?)\s+(?:at|for|on)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?)/i,
      // "meeting at 3pm"
      /(.+?)\s+(?:at|for|on)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?)/i,
      // "3pm meeting"
      /(\d{1,2}(?::\d{2})?\s*[ap]m?)\s+(.+)/i,
      // "meeting 3pm"
      /(.+?)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?)/i,
      // Military time formats
      /(?:schedule|add|book|create)\s+(.+?)\s+(?:at|for|on)\s+(\d{1,2}:\d{2})/i,
      /(.+?)\s+(?:at|for|on)\s+(\d{1,2}:\d{2})/i,
      // "o'clock" format
      /(?:schedule|add|book|create)\s+(.+?)\s+(?:at|for|on)\s+(\d{1,2}\s*o'?clock\s*[ap]m?)/i,
      /(.+?)\s+(?:at|for|on)\s+(\d{1,2}\s*o'?clock\s*[ap]m?)/i
    ];

    let eventText = null;
    let timeStr = null;

    // Try each pattern until we find a match
    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        // Determine which group contains the event and which contains the time
        if (pattern.source.includes('\\d{1,2}(?::\\d{2})?\\s*[ap]m?') && 
            pattern.source.includes('\\d{1,2}(?::\\d{2})?\\s*[ap]m?') === pattern.source.lastIndexOf('\\d{1,2}(?::\\d{2})?\\s*[ap]m?')) {
          // Time is in the last group
          eventText = match[1].trim();
          timeStr = match[2].trim();
        } else {
          // Standard format: event first, time second
          eventText = match[1].trim();
          timeStr = match[2].trim();
        }
        break;
      }
    }

    if (eventText && timeStr) {
      console.log(`Extracted event text: '${eventText}'`);
      console.log(`Extracted time string: '${timeStr}'`);
      
      const time = parseTime(timeStr);
      if (time) {
        // Check if there's already an event at this time
        if (events[time]) {
          showFeedback(`⚠️ There's already an event at ${formatTimeDisplay(time)}. Use "reschedule" to move it.`, 'error');
          return;
        }
        
        setEvents((prevEvents) => ({ ...prevEvents, [time]: eventText }));
        showFeedback(`✅ Scheduled: "${eventText}" at ${formatTimeDisplay(time)}`, 'success');
      } else {
        showFeedback(`❌ Could not schedule. Invalid time: "${timeStr}". Try saying times like "3pm", "3:30pm", or "15:30"`, 'error');
      }
    } else {
      showFeedback(`❌ Could not understand command: "${command}". Try saying "schedule meeting at 3pm" or "meeting at 3:30pm"`, 'error');
    }
  }, [events, parseTime, formatTimeDisplay, findEventByName, cancelEvent, rescheduleEvent, showFeedback]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showFeedback('❌ Speech recognition is not supported in this browser. Try Chrome or Edge.', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('Speech recognition started.');
      setIsListening(true);
      showFeedback('🎤 Listening... Say something like "schedule meeting at 3pm"', 'info');
    };

    recognition.onend = () => {
      console.log('Speech recognition ended.');
      setIsListening(false);
      
      // Auto-restart if we're supposed to be listening
      if (isListening) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error("Error restarting speech recognition:", error);
            setIsListening(false);
            showFeedback('❌ Speech recognition failed to restart. Please try again.', 'error');
          }
        }, 100);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error, event.message);
      
      let errorMessage = 'Speech recognition error occurred.';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not available.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      showFeedback(`❌ ${errorMessage}`, 'error');
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      console.log(`Voice command: ${transcript}`);
      
      // Only process if this is a final result
      if (event.results[event.results.length - 1].isFinal) {
        processVoiceCommand(transcript);
      }
    };

    recognitionRef.current = recognition;
  }, [isListening, processVoiceCommand, showFeedback]);

  const handleListen = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      showFeedback('🔇 Voice recognition stopped', 'info');
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false);
        showFeedback('❌ Failed to start voice recognition. Please try again.', 'error');
      }
    }
  };

  const clearAllEvents = () => {
    if (window.confirm('Are you sure you want to clear all events?')) {
      setEvents({});
      showFeedback('🗑️ All events cleared', 'info');
    }
  };

  // Test function for debugging voice commands
  const testVoiceCommands = useCallback(() => {
    const testCommands = [
      "schedule meeting at 3pm",
      "add lunch at 12:30pm", 
      "meeting at 2pm",
      "3pm team call",
      "dinner at 7 o'clock",
      "15:30 workout",
      "book appointment at 10am",
      "meeting for 4pm",
      "9pm movie",
      "workout at 6:30pm",
      "reschedule meeting to 4pm",
      "move lunch to 1pm",
      "cancel meeting at 3pm",
      "delete lunch",
      "remove 2pm meeting"
    ];
    
    console.log('Testing voice commands...');
    testCommands.forEach((command, index) => {
      setTimeout(() => {
        console.log(`Testing: "${command}"`);
        processVoiceCommand(command);
      }, index * 1000);
    });
  }, [processVoiceCommand]);

  // Expose test function to window for debugging
  useEffect(() => {
    window.testVoiceCommands = testVoiceCommands;
    console.log('Voice command test function available: window.testVoiceCommands()');
  }, [testVoiceCommands]);

  const handleEventChange = (time, newEvent) => {
    setEvents(prev => ({...prev, [time]: newEvent}));
  };

  return (
    <div className="app">
      <h1>Today's Plan</h1>
      
      <div className="help-section">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: 16 }}>
          <button 
            onClick={() => setShowHelp(!showHelp)} 
            className="help-toggle"
          >
            {showHelp ? 'Hide Help' : 'Show Voice Commands'}
          </button>
          <button
            onClick={handleListen}
            className={`voice-button ${isListening ? 'listening' : ''}`}
            style={{ minWidth: 180 }}
          >
            {isListening ? 'Listening...' : 'Start Voice Command'}
          </button>
          <button
            onClick={clearAllEvents}
            className="clear-button"
            style={{ minWidth: 150 }}
          >
            Clear All Events
          </button>
        </div>
        {showHelp && (
          <div className="help-content">
            <h3>Voice Command Examples:</h3>
            <h4>📅 Scheduling:</h4>
            <ul>
              <li>"Schedule meeting at 3pm"</li>
              <li>"Add lunch at 12:30pm"</li>
              <li>"Meeting at 2pm"</li>
              <li>"3pm team call"</li>
              <li>"Dinner at 7 o'clock"</li>
              <li>"15:30 workout"</li>
              <li>"Book appointment at 10am"</li>
            </ul>
            
            <h4>🔄 Rescheduling:</h4>
            <ul>
              <li>"Reschedule meeting to 4pm"</li>
              <li>"Move lunch to 1pm"</li>
              <li>"Change meeting at 3pm to 5pm"</li>
              <li>"Reschedule workout to 6:30pm"</li>
            </ul>
            
            <h4>🗑️ Cancelling:</h4>
            <ul>
              <li>"Cancel meeting at 3pm"</li>
              <li>"Delete lunch"</li>
              <li>"Remove 2pm meeting"</li>
              <li>"Cancel the event at 4pm"</li>
            </ul>
            
            <p><strong>Supported time formats:</strong> 3pm, 3:30pm, 15:30, 3 o'clock</p>
            <p><strong>Time range:</strong> 5:00 AM - 11:00 PM</p>
          </div>
        )}
      </div>
      
      <div className="time-slots">
        {hours.map((hour) => (
          <TimeSlot
            key={hour}
            time={hour}
            event={events[hour] || ''}
            onEventChange={(newEvent) => handleEventChange(hour, newEvent)}
            formatTimeDisplay={formatTimeDisplay}
          />
        ))}
      </div>
      <div className="voice-button-container">
        <button onClick={handleListen} className={`voice-button ${isListening ? 'listening' : ''}`} style={{ minWidth: 180 }}>
          {isListening ? 'Listening...' : 'Start Voice Command'}
        </button>
      </div>
      <div className="clear-button-container">
        <button onClick={clearAllEvents} className="clear-button" style={{ minWidth: 150 }}>
          Clear All Events
        </button>
      </div>
    </div>
  );
};

export default App;
