#!python3
import asyncio
import json
import irsdk
import logging
from logging.handlers import TimedRotatingFileHandler
import os
import time
from datetime import datetime
import websockets

if not os.path.exists('C:/iracing_telemetry'):
    os.mkdir('C:/iracing_telemetry')
if not os.path.exists('C:/iracing_telemetry/app'):
    os.mkdir('C:/iracing_telemetry/app')
if not os.path.exists('C:/iracing_telemetry/data'):
    os.mkdir('C:/iracing_telemetry/data')

#set path to store log files
data_path = 'C:/iracing_telemetry/data/json.log'
app_path = 'C:/iracing_telemetry/app/json.log'

# create dict for values of txt from github pyirsdk repo

normalised_dict = {
    'BrakeRaw': '',
    'EngineWarnings': '',
    'FastRepairAvailable': '',
    'FastRepairUsed': '',
    'FuelLevel': '',
    'FuelLevelPct': '',
    'FuelUsePerHour': '',
    'Gear': '',
    'IsInGarage': '',
    'IsOnTrack': '',
    'IsOnTrackCar': '',
    'Lap': '',
    'LapBestLap': '',
    'LapBestLapTime': '',
    'LapCompleted': '',
    'LapCurrentLapTime': '',
    'LapDist': '',
    'LapDistPct': '',
    'LapLastLapTime': '',
    'LatAccel_ST': '',
    'LFtempCL': '',
    'LFtempCM': '',
    'LFtempCR': '',
    'LFwearL': '',
    'LFwearM': '',
    'LFwearR': '',
    'LongAccel_ST': '',
    'LRtempCL': '',
    'LRtempCM': '',
    'LRtempCR': '',
    'LRwearL': '',
    'LRwearM': '',
    'LRwearR': '',
    'OilLevel': '',
    'OilPress': '',
    'OilTemp': '',
    'OnPitRoad': '',
    'PitstopActive': '',
    'PlayerCarInPitStall': '',
    'PlayerCarMyIncidentCount': '',
    'PlayerCarPosition': '',
    'PlayerCarTowTime': '',
    'PlayerTrackSurface': '',
    'PlayerTrackSurfaceMaterial': '',
    'RaceLaps': '',
    'RFtempCL': '',
    'RFtempCM': '',
    'RFtempCR': '',
    'RFwearL': '',
    'RFwearM': '',
    'RFwearR': '',
    'Roll': '',
    'RollRate': '',
    'RollRate_ST': '',
    'RPM': '',
    'RRtempCL': '',
    'RRtempCM': '',
    'RRtempCR': '',
    'RRwearL': '',
    'RRwearM': '',
    'RRwearR': '',
    'SessionFlags': '',
    'SessionNum': '',
    'SessionState': '',
    'SessionTime': '',
    'SessionTimeRemain': '',
    'SessionUniqueID': '',
    'ShiftGrindRPM': '',
    'ShiftIndicatorPct': '',
    'ShiftPowerPct': '',
    'Speed': '',
    'SteeringWheelAngle': '',
    'SteeringWheelAngleMax': '',
    'SteeringWheelPctDamper': '',
    'SteeringWheelPctTorque': '',
    'SteeringWheelPctTorqueSign': '',
    'SteeringWheelPctTorqueSignStops': '',
    'SteeringWheelPeakForceNm': '',
    'SteeringWheelTorque': '',
    'SteeringWheelTorque_ST': '',
    'ThrottleRaw': '',
    'VelocityX_ST': '',
    'VelocityY_ST': '',
    'VelocityZ_ST': '',
    'VertAccel_ST': ''
}

camera_dict = {
    'CamCameraNumber': '',
    'CamCameraState': '',
    'CamCarIdx': '',
    'CamGroupNumber': '',
    'ReplayFrameNum': '',
    'ReplayFrameNumEnd': '',
    'ReplayPlaySlowMotion': '',
    'ReplayPlaySpeed': '',
    'ReplaySessionNum': '',
    'ReplaySessionTime': '',
    'SessionUniqueID': ''
}

compute_dict = {
    'CpuUsageBG': '',
    'FrameRate': '',
    'IsDiskLoggingActive': '',
    'IsDiskLoggingEnabled': '',
    'IsReplayPlaying': '',
    'LoadNumTextures': '',
    'OkToReloadTextures': '',
    'SessionNum': '',
    'SessionState': '',
    'SessionTick': '',
    'SessionTime': '',
    'SessionUniqueID': ''
}

environment_dict = {
    'AirDensity': '',
    'AirPressure': '',
    'AirTemp': '',
    'FogLevel': '',
    'PlayerTrackSurface': '',
    'PlayerTrackSurfaceMaterial': '',
    'RelativeHumidity': '',
    'SessionTimeOfDay': '',
    'Skies': '',
    'TrackTempCrew': '',
    'WeatherType': '',
    'WindDir': '',
    'WindVel': '',
    'SessionUniqueID': ''
}

race_dict = {
    'CarIdxBestLapNum': '',
    'CarIdxBestLapTime': '',
    'CarIdxClassPosition': '',
    'CarIdxEstTime': '',
    'CarIdxF2Time': '',
    'CarIdxLap': '',
    'CarIdxLapCompleted': '',
    'CarIdxLapDistPct': '',
    'CarIdxLastLapTime': '',
    'CarIdxOnPitRoad': '',
    'CarIdxP2P_Count': '',
    'CarIdxP2P_Status': '',
    'CarIdxPaceFlags': '',
    'CarIdxPaceLine': '',
    'CarIdxPaceRow': '',
    'CarIdxPosition': '',
    'CarLeftRight': '',
    'DCDriversSoFar': '',
    'DCLapStatus': '',
    'DisplayUnits': '',
    'dpFastRepair': '',
    'dpFuelAddKg': '',
    'dpFuelFill': '',
    'dpLFTireChange': '',
    'dpLFTireColdPress': '',
    'dpLRTireChange': '',
    'dpLRTireColdPress': '',
    'dpRFTireChange': '',
    'dpRFTireColdPress': '',
    'dpRRTireChange': '',
    'dpRRTireColdPress': '',
    'dpWindshieldTearoff': '',
    'DriverMarker': '',
    'EnterExitReset': '',
    'FastRepairAvailable': '',
    'FastRepairUsed': '',
    'FrontTireSetsAvailable': '',
    'FrontTireSetsUsed': '',
    'IsInGarage': '',
    'IsOnTrack': '',
    'IsOnTrackCar': '',
    'Lap': '',
    'LapBestLap': '',
    'LapBestLapTime': '',
    'LapBestNLapLap': '',
    'LapBestNLapTime': '',
    'LapCompleted': '',
    'LapCurrentLapTime': '',
    'LapDeltaToBestLap': '',
    'LapDeltaToBestLap_DD': '',
    'LapDeltaToBestLap_OK': '',
    'LapDeltaToOptimalLap': '',
    'LapDeltaToOptimalLap_DD': '',
    'LapDeltaToOptimalLap_OK': '',
    'LapDeltaToSessionBestLap': '',
    'LapDeltaToSessionBestLap_DD': '',
    'LapDeltaToSessionBestLap_OK': '',
    'LapDeltaToSessionLastlLap': '',
    'LapDeltaToSessionLastlLap_DD': '',
    'LapDeltaToSessionLastlLap_OK': '',
    'LapDeltaToSessionOptimalLap': '',
    'LapDeltaToSessionOptimalLap_DD': '',
    'LapDeltaToSessionOptimalLap_OK': '',
    'LapDist': '',
    'LapDistPct': '',
    'LapLasNLapSeq': '',
    'LapLastLapTime': '',
    'LapLastNLapTime': '',
    'LeftTireSetsAvailable': '',
    'LeftTireSetsUsed': '',
    'LFTiresAvailable': '',
    'LFTiresUsed': '',
    'LRTiresAvailable': '',
    'LRTiresUsed': '',
    'OnPitRoad': '',
    'PaceMode': '',
    'PitOptRepairLeft': '',
    'PitRepairLeft': '',
    'PitsOpen': '',
    'PitstopActive': '',
    'PitSvFlags': '',
    'PitSvFuel': '',
    'PitSvLFP': '',
    'PitSvLRP': '',
    'PitSvRFP': '',
    'PitSvRRP': '',
    'PlayerCarClassPosition': '',
    'PlayerCarDriverIncidentCount': '',
    'PlayerCarIdx': '',
    'PlayerCarInPitStall': '',
    'PlayerCarMyIncidentCount': '',
    'PlayerCarPitSvStatus': '',
    'PlayerCarPosition': '',
    'PlayerCarTeamIncidentCount': '',
    'PlayerCarTowTime': '',
    'PlayerCarWeightPenalty': '',
    'PushToPass': '',
    'RaceLaps': '',
    'RadioTransmitCarIdx': '',
    'RadioTransmitFrequencyIdx': '',
    'RadioTransmitRadioIdx': '',
    'RearTireSetsAvailable': '',
    'RearTireSetsUsed': '',
    'RFTiresAvailable': '',
    'RFTiresUsed': '',
    'RightTireSetsAvailable': '',
    'RightTireSetsUsed': '',
    'RRTiresAvailable': '',
    'RRTiresUsed': '',
    'SessionFlags': '',
    'SessionLapsRemain': '',
    'SessionLapsRemainEx': '',
    'SessionTimeRemain': '',
    'TireSetsAvailable': '',
    'TireSetsUsed': '',
    'SessionUniqueID': ''
}

track_dict = {
    'CarIdxTrackSurface': '',
    'CarIdxTrackSurfaceMaterial': '',
    'SessionUniqueID': ''
}

vehicle_dict = {
    'Brake': '',
    'BrakeRaw': '',
    'CarIdxGear': '',
    'CarIdxRPM': '',
    'CarIdxSteer': '',
    'Clutch': '',
    'dcStarter': '',
    'EngineWarnings': '',
    'FuelLevel': '',
    'FuelLevelPct': '',
    'FuelPress': '',
    'FuelUsePerHour': '',
    'Gear': '',
    'HandbrakeRaw': '',
    'LatAccel': '',
    'LatAccel_ST': '',
    'LFbrakeLinePress': '',
    'LFcoldPressure': '',
    'LFshockDefl': '',
    'LFshockDefl_ST': '',
    'LFshockVel': '',
    'LFshockVel_ST': '',
    'LFtempCL': '',
    'LFtempCM': '',
    'LFtempCR': '',
    'LFwearL': '',
    'LFwearM': '',
    'LFwearR': '',
    'LongAccel': '',
    'LongAccel_ST': '',
    'LRbrakeLinePress': '',
    'LRcoldPressure': '',
    'LRshockDefl': '',
    'LRshockDefl_ST': '',
    'LRshockVel': '',
    'LRshockVel_ST': '',
    'LRtempCL': '',
    'LRtempCM': '',
    'LRtempCR': '',
    'LRwearL': '',
    'LRwearM': '',
    'LRwearR': '',
    'ManifoldPress': '',
    'ManualBoost': '',
    'ManualNoBoost': '',
    'OilLevel': '',
    'OilPress': '',
    'OilTemp': '',
    'Pitch': '',
    'PitchRate': '',
    'PitchRate_ST': '',
    'PlayerCarDryTireSetLimit': '',
    'PlayerCarPowerAdjust': '',
    'RFbrakeLinePress': '',
    'RFcoldPressure': '',
    'RFshockDefl': '',
    'RFshockDefl_ST': '',
    'RFshockVel': '',
    'RFshockVel_ST': '',
    'RFtempCL': '',
    'RFtempCM': '',
    'RFtempCR': '',
    'RFwearL': '',
    'RFwearM': '',
    'RFwearR': '',
    'Roll': '',
    'RollRate': '',
    'RollRate_ST': '',
    'RPM': '',
    'RRbrakeLinePress': '',
    'RRcoldPressure': '',
    'RRshockDefl': '',
    'RRshockDefl_ST': '',
    'RRshockVel': '',
    'RRshockVel_ST': '',
    'RRtempCL': '',
    'RRtempCM': '',
    'RRtempCR': '',
    'RRwearL': '',
    'RRwearM': '',
    'RRwearR': '',
    'ShiftGrindRPM': '',
    'ShiftPowerPct': '',
    'Speed': '',
    'SteeringWheelAngle': '',
    'SteeringWheelAngleMax': '',
    'SteeringWheelPctDamper': '',
    'SteeringWheelPctTorque': '',
    'SteeringWheelPctTorqueSign': '',
    'SteeringWheelPctTorqueSignStops': '',
    'SteeringWheelPeakForceNm': '',
    'SteeringWheelTorque': '',
    'SteeringWheelTorque_ST': '',
    'Throttle': '',
    'ThrottleRaw': '',
    'TireLF_RumblePitch': '',
    'TireLR_RumblePitch': '',
    'TireRF_RumblePitch': '',
    'TireRR_RumblePitch': '',
    'VelocityX': '',
    'VelocityX_ST': '',
    'VelocityY': '',
    'VelocityY_ST': '',
    'VelocityZ': '',
    'VelocityZ_ST': '',
    'VertAccel': '',
    'VertAccel_ST': '',
    'Voltage': '',
    'WaterLevel': '',
    'WaterTemp': '',
    'Yaw': '',
    'YawNorth': '',
    'YawRate': '',
    'YawRate_ST': '',
    'SessionUniqueID': ''
}

#configure logging rotation
data_logger = logging.getLogger("Rotating Data Log")
data_logger.setLevel(logging.INFO)
data_handler = TimedRotatingFileHandler(data_path, when='m', interval=1, backupCount=120)
data_logger.addHandler(data_handler)

app_logger = logging.getLogger("Rotating App Log")
app_logger.setLevel(logging.INFO)
app_handler = TimedRotatingFileHandler(app_path, when='m', interval=1, backupCount=120)
app_logger.addHandler(app_handler)

# this is our State class, with some helpful variables
class State:
    ir_connected = False
    last_car_setup_tick = -1

# here we check if we are connected to iracing
# so we can retrieve some data
def check_iracing():
    if state.ir_connected and not (ir.is_initialized and ir.is_connected):
        state.ir_connected = False
        # don't forget to reset your State variables
        state.last_car_setup_tick = -1
        # we are shutting down ir library (clearing all internal variables)
        ir.shutdown()
        app_logger.info(time.ctime() + ' irsdk disconnected')
    elif not state.ir_connected and ir.startup() and ir.is_initialized and ir.is_connected:
        state.ir_connected = True
        app_logger.info(time.ctime() + ' irsdk connected')

async def test(speed):
    async with websockets.connect('ws://192.168.0.16:8080/ws') as websocket:
        await websocket.send(speed)

def hec_send(ir_json,source):

    ir_json['ts_send'] = str(datetime.utcnow())
    event = {}
    event['host'] = "Oliver Parkinson"
    event['source'] = source
    event['event'] = ir_json
    print(json.dumps(event['event']['Speed'], sort_keys=True, indent=4)) 
    asyncio.run(test(str(event['event']['Speed'])))
    # print(event['event']['speed'])
    # url = splunk_instance
    # header = {'Authorization' : '{}'.format('Splunk ' + hec_token)}
    # try:
    #     response = requests.post(
    #             url=url,
    #             data=json.dumps(event),
    #             headers=header)
    #     response.raise_for_status()

    # except requests.exceptions.HTTPError as err:
    #     data_logger.info(json.dumps(event)) 
    #     app_logger.error(err)

def loop(json_dict, source):
    for key, value in json_dict.items():
        value = ir[key]
        json_dict.update({key: value})
    app_logger.info(time.ctime() + " json_dict: logged")
    hec_send(json_dict, source)

if __name__ == '__main__':
    # initializing ir and state
    ir = irsdk.IRSDK()
    state = State()

    try:
        # infinite loop
        i = 0
        while True:
            # check if we are connected to iracing
            check_iracing()

            i += 1
            # if we are, then process data
            if state.ir_connected:

                # loop(normalised_dict, "NormalisedRace")

                # if i % 20 == 0:
                #     loop(track_dict, "Track")
                # elif (i + 3) % 20 == 0:
                #     loop(compute_dict, "Compute")
                # elif (i + 6) % 20 == 0:
                #     loop(camera_dict, "Camera")
                # elif (i + 9) % 20 == 0:
                #     loop(vehicle_dict, "Vehicle")
                # elif (i + 12) % 20 == 0:
                #     loop(race_dict, "Race")
                # elif (i + 15) % 20 == 0:
                #     loop(environment_dict, "Env")
                loop(vehicle_dict, "Vehicle")
            # sleep for 1 second
            # maximum you can use is 1/60
            # cause iracing updates data with 60 fps
            if i > 1000:
                0
            time.sleep(0.3)
    except KeyboardInterrupt:
        # press ctrl+c to exit
        pass
