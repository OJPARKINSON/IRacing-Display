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
"""
mydict = {
    'time': '',
    'AirDensity': '',
    'AirPressure': '',
    'AirTemp': '',
    'Brake': '',
    'BrakeRaw': '',
    'CamCameraNumber': '',
    'CamCameraState': '',
    'CamCarIdx': '',
    'CamGroupNumber': '',
    'CarIdxBestLapNum': '',
    'CarIdxBestLapTime': '',
    'CarIdxClassPosition': '',
    'CarIdxEstTime': '',
    'CarIdxF2Time': '',
    'CarIdxGear': '',
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
    'CarIdxRPM': '',
    'CarIdxSteer': '',
    'CarIdxTrackSurface': '',
    'CarIdxTrackSurfaceMaterial': '',
    'CarLeftRight': '',
    'Clutch': '',
    'CpuUsageBG': '',
    'DCDriversSoFar': '',
    'DCLapStatus': '',
    'dcStarter': '',
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
    'EngineWarnings': '',
    'EnterExitReset': '',
    'FastRepairAvailable': '',
    'FastRepairUsed': '',
    'FogLevel': '',
    'FrameRate': '',
    'FrontTireSetsAvailable': '',
    'FrontTireSetsUsed': '',
    'FuelLevel': '',
    'FuelLevelPct': '',
    'FuelPress': '',
    'FuelUsePerHour': '',
    'Gear': '',
    'HandbrakeRaw': '',
    'IsDiskLoggingActive': '',
    'IsDiskLoggingEnabled': '',
    'IsInGarage': '',
    'IsOnTrack': '',
    'IsOnTrackCar': '',
    'IsReplayPlaying': '',
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
    'LatAccel': '',
    'LatAccel_ST': '',
    'LeftTireSetsAvailable': '',
    'LeftTireSetsUsed': '',
    'LFbrakeLinePress': '',
    'LFcoldPressure': '',
    'LFshockDefl': '',
    'LFshockDefl_ST': '',
    'LFshockVel': '',
    'LFshockVel_ST': '',
    'LFtempCL': '',
    'LFtempCM': '',
    'LFtempCR': '',
    'LFTiresAvailable': '',
    'LFTiresUsed': '',
    'LFwearL': '',
    'LFwearM': '',
    'LFwearR': '',
    'LoadNumTextures': '',
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
    'LRTiresAvailable': '',
    'LRTiresUsed': '',
    'LRwearL': '',
    'LRwearM': '',
    'LRwearR': '',
    'ManifoldPress': '',
    'ManualBoost': '',
    'ManualNoBoost': '',
    'OilLevel': '',
    'OilPress': '',
    'OilTemp': '',
    'OkToReloadTextures': '',
    'OnPitRoad': '',
    'PaceMode': '',
    'Pitch': '',
    'PitchRate': '',
    'PitchRate_ST': '',
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
    'PlayerCarDryTireSetLimit': '',
    'PlayerCarIdx': '',
    'PlayerCarInPitStall': '',
    'PlayerCarMyIncidentCount': '',
    'PlayerCarPitSvStatus': '',
    'PlayerCarPosition': '',
    'PlayerCarPowerAdjust': '',
    'PlayerCarTeamIncidentCount': '',
    'PlayerCarTowTime': '',
    'PlayerCarWeightPenalty': '',
    'PlayerTrackSurface': '',
    'PlayerTrackSurfaceMaterial': '',
    'PushToPass': '',
    'RaceLaps': '',
    'RadioTransmitCarIdx': '',
    'RadioTransmitFrequencyIdx': '',
    'RadioTransmitRadioIdx': '',
    'RearTireSetsAvailable': '',
    'RearTireSetsUsed': '',
    'RelativeHumidity': '',
    'ReplayFrameNum': '',
    'ReplayFrameNumEnd': '',
    'ReplayPlaySlowMotion': '',
    'ReplayPlaySpeed': '',
    'ReplaySessionNum': '',
    'ReplaySessionTime': '',
    'RFbrakeLinePress': '',
    'RFcoldPressure': '',
    'RFshockDefl': '',
    'RFshockDefl_ST': '',
    'RFshockVel': '',
    'RFshockVel_ST': '',
    'RFtempCL': '',
    'RFtempCM': '',
    'RFtempCR': '',
    'RFTiresAvailable': '',
    'RFTiresUsed': '',
    'RFwearL': '',
    'RFwearM': '',
    'RFwearR': '',
    'RightTireSetsAvailable': '',
    'RightTireSetsUsed': '',
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
    'RRTiresAvailable': '',
    'RRTiresUsed': '',
    'RRwearL': '',
    'RRwearM': '',
    'RRwearR': '',
    'SessionFlags': '',
    'SessionLapsRemain': '',
    'SessionLapsRemainEx': '',
    'SessionNum': '',
    'SessionState': '',
    'SessionTick': '',
    'SessionTime': '',
    'SessionTimeOfDay': '',
    'SessionTimeRemain': '',
    'SessionUniqueID': '',
    'ShiftGrindRPM': '',
    'ShiftIndicatorPct': '',
    'ShiftPowerPct': '',
    'Skies': '',
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
    'TireSetsAvailable': '',
    'TireSetsUsed': '',
    'TrackTemp': '',
    'TrackTempCrew': '',
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
    'WeatherType': '',
    'WindDir': '',
    'WindVel': '',
    'Yaw': '',
    'YawNorth': '',
    'YawRate': '',
    'YawRate_ST': ''
}
"""

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


#     {
#     "event": {
#         "BrakeRaw": 0.0,
#         "EngineWarnings": 0,
#         "FastRepairAvailable": 0,
#         "FastRepairUsed": 0,
#         "FuelLevel": 58.13869094848633,
#         "FuelLevelPct": 0.581386923789978,
#         "FuelUsePerHour": 2.768016815185547,
#         "Gear": 1,
#         "IsInGarage": false,
#         "IsOnTrack": true,
#         "IsOnTrackCar": true,
#         "LFtempCL": 59.460723876953125,
#         "LFtempCM": 59.460723876953125,
#         "LFtempCR": 59.460723876953125,
#         "LFwearL": 1.0,
#         "LFwearM": 1.0,
#         "LFwearR": 1.0,
#         "LRtempCL": 59.473297119140625,
#         "LRtempCM": 59.473297119140625,
#         "LRtempCR": 59.473297119140625,
#         "LRwearL": 1.0,
#         "LRwearM": 1.0,
#         "LRwearR": 1.0,
#         "Lap": 0,
#         "LapBestLap": 0,
#         "LapBestLapTime": 0.0,
#         "LapCompleted": -1,
#         "LapCurrentLapTime": 0.0,
#         "LapDist": 283.4114074707031,
#         "LapDistPct": 0.06256657093763351,
#         "LapLastLapTime": 0.0,
#         "LatAccel_ST": [
#             0.09866375476121902,
#             0.09867706894874573,
#             0.10150351375341415,
#             0.1007823720574379,
#             0.0952201709151268,
#             0.09539167582988739
#         ],
#         "LongAccel_ST": [
#             0.006045768968760967,
#             0.005029124207794666,
#             0.004105802159756422,
#             0.005792975891381502,
#             0.0033573932014405727,
#             0.0031798360869288445
#         ],
#         "OilLevel": 7.0,
#         "OilPress": 1.1249996423721313,
#         "OilTemp": 80.33226013183594,
#         "OnPitRoad": false,
#         "PitstopActive": false,
#         "PlayerCarInPitStall": false,
#         "PlayerCarMyIncidentCount": 0,
#         "PlayerCarPosition": 0,
#         "PlayerCarTowTime": 0.0,
#         "PlayerTrackSurface": 2,
#         "PlayerTrackSurfaceMaterial": 1,
#         "RFtempCL": 59.460723876953125,
#         "RFtempCM": 59.460723876953125,
#         "RFtempCR": 59.460723876953125,
#         "RFwearL": 1.0,
#         "RFwearM": 1.0,
#         "RFwearR": 1.0,
#         "RPM": 1420.16796875,
#         "RRtempCL": 59.473297119140625,
#         "RRtempCM": 59.473297119140625,
#         "RRtempCR": 59.473297119140625,
#         "RRwearL": 1.0,
#         "RRwearM": 1.0,
#         "RRwearR": 1.0,
#         "RaceLaps": 0,
#         "Roll": 0.010017032735049725,
#         "RollRate": -0.00037096484447829425,
#         "RollRate_ST": [
#             -0.0005337609327398241,
#             -0.0005655100103467703,
#             -0.0005487120943143964,
#             -0.0004864302754867822,
#             -0.00042563219903968275,
#             -0.00037096484447829425
#         ],
#         "SessionFlags": 268698112,
#         "SessionNum": 0,
#         "SessionState": 4,
#         "SessionTime": 969.6666653945484,
#         "SessionTimeRemain": 604800.0,
#         "SessionUniqueID": 1,
#         "ShiftGrindRPM": 0.0,
#         "ShiftIndicatorPct": 0.0,
#         "ShiftPowerPct": 0.0,
#         "Speed": 0.00020316596783231944,
#         "SteeringWheelAngle": 0.053742967545986176,
#         "SteeringWheelAngleMax": 6.0615234375,
#         "SteeringWheelPctDamper": 0.07000000029802322,
#         "SteeringWheelPctTorque": 0.009366266429424286,
#         "SteeringWheelPctTorqueSign": 0.009366266429424286,
#         "SteeringWheelPctTorqueSignStops": 0.002798896748572588,
#         "SteeringWheelPeakForceNm": -1.0,
#         "SteeringWheelTorque": 0.15064004063606262,
#         "SteeringWheelTorque_ST": [
#             0.16709765791893005,
#             0.17186573147773743,
#             0.15191146731376648,
#             0.14926297962665558,
#             0.14965912699699402,
#             0.15064004063606262
#         ],
#         "ThrottleRaw": 0.0,
#         "VelocityX_ST": [
#             -1.800885729608126e-05,
#             -1.3392097571340855e-05,
#             -1.1340351193211973e-05,
#             -4.602137778420001e-06,
#             -4.63065407529939e-06,
#             -5.153662641532719e-06
#         ],
#         "VelocityY_ST": [
#             -0.00020420928194653243,
#             -0.00020299380412325263,
#             -0.0001939225330715999,
#             -0.00018684437964111567,
#             -0.00019521111971698701,
#             -0.00020310058607719839
#         ],
#         "VelocityZ_ST": [
#             -6.349949217110407e-06,
#             -1.3397012480709236e-05,
#             -2.1131003450136632e-05,
#             -1.5015767530712765e-05,
#             -4.1712810343597084e-06,
#             4.1228604459320195e-06
#         ],
#         "VertAccel_ST": [
#             9.807509422302246,
#             9.803620338439941,
#             9.803372383117676,
#             9.808359146118164,
#             9.81006145477295,
#             9.80914306640625
#         ],
#         "ts_send": "2024-08-08 20:29:29.730110"
#     },
#     "source": "NormalisedRace"
# }
# {
#     "event": {
#         "BrakeRaw": 0.0,
#         "EngineWarnings": 0,
#         "FastRepairAvailable": 0,
#         "FastRepairUsed": 0,
#         "FuelLevel": 58.13838195800781,
#         "FuelLevelPct": 0.5813838243484497,
#         "FuelUsePerHour": 2.768016815185547,
#         "Gear": 1,
#         "IsInGarage": false,
#         "IsOnTrack": true,
#         "IsOnTrackCar": true,
#         "LFtempCL": 59.460723876953125,
#         "LFtempCM": 59.460723876953125,
#         "LFtempCR": 59.460723876953125,
#         "LFwearL": 1.0,
#         "LFwearM": 1.0,
#         "LFwearR": 1.0,
#         "LRtempCL": 59.473297119140625,
#         "LRtempCM": 59.473297119140625,
#         "LRtempCR": 59.473297119140625,
#         "LRwearL": 1.0,
#         "LRwearM": 1.0,
#         "LRwearR": 1.0,
#         "Lap": 0,
#         "LapBestLap": 0,
#         "LapBestLapTime": 0.0,
#         "LapCompleted": -1,
#         "LapCurrentLapTime": 0.0,
#         "LapDist": 283.4114074707031,
#         "LapDistPct": 0.06256657093763351,
#         "LapLastLapTime": 0.0,
#         "LatAccel_ST": [
#             0.09161286801099777,
#             0.09854891151189804,
#             0.10421103239059448,
#             0.0915784016251564,
#             0.09269776940345764,
#             0.09381475299596786
#         ],
#         "LongAccel_ST": [
#             0.0020558179821819067,
#             0.0025576355401426554,
#             0.00548949558287859,
#             0.005260958801954985,
#             0.004824250936508179,
#             0.004852068144828081
#         ],
#         "OilLevel": 7.0,
#         "OilPress": 1.1249996423721313,
#         "OilTemp": 80.35739135742188,
#         "OnPitRoad": false,
#         "PitstopActive": false,
#         "PlayerCarInPitStall": false,
#         "PlayerCarMyIncidentCount": 0,
#         "PlayerCarPosition": 0,
#         "PlayerCarTowTime": 0.0,
#         "PlayerTrackSurface": 2,
#         "PlayerTrackSurfaceMaterial": 1,
#         "RFtempCL": 59.460723876953125,
#         "RFtempCM": 59.460723876953125,
#         "RFtempCR": 59.460723876953125,
#         "RFwearL": 1.0,
#         "RFwearM": 1.0,
#         "RFwearR": 1.0,
#         "RPM": 1420.169921875,
#         "RRtempCL": 59.473297119140625,
#         "RRtempCM": 59.473297119140625,
#         "RRtempCR": 59.473297119140625,
#         "RRwearL": 1.0,
#         "RRwearM": 1.0,
#         "RRwearR": 1.0,
#         "RaceLaps": 0,
#         "Roll": 0.01002103928476572,
#         "RollRate": -0.0005114026134833694,
#         "RollRate_ST": [
#             -0.0002222883776994422,
#             -0.0002942786377388984,
#             -0.00025217849179171026,
#             -0.00034309527836740017,
#             -0.00043489295057952404,
#             -0.0005114026134833694
#         ],
#         "SessionFlags": 268698112,
#         "SessionNum": 0,
#         "SessionState": 4,
#         "SessionTime": 969.9666653945482,
#         "SessionTimeRemain": 604800.0,
#         "SessionUniqueID": 1,
#         "ShiftGrindRPM": 0.0,
#         "ShiftIndicatorPct": 0.0,
#         "ShiftPowerPct": 0.0,
#         "Speed": 0.0002492223575245589,
#         "SteeringWheelAngle": 0.051970336586236954,
#         "SteeringWheelAngleMax": 6.0615234375,
#         "SteeringWheelPctDamper": 0.07000000029802322,
#         "SteeringWheelPctTorque": 0.013562088832259178,
#         "SteeringWheelPctTorqueSign": 0.013562088832259178,
#         "SteeringWheelPctTorqueSignStops": 0.004475754220038652,
#         "SteeringWheelPeakForceNm": -1.0,
#         "SteeringWheelTorque": 0.21812251210212708,
#         "SteeringWheelTorque_ST": [
#             0.19892939925193787,
#             0.1854511797428131,
#             0.18639317154884338,
#             0.20681944489479065,
#             0.2178288698196411,
#             0.21812251210212708
#         ],
#         "ThrottleRaw": 0.0,
#         "VelocityX_ST": [
#             -2.0078194211237133e-05,
#             -2.2313592126010917e-05,
#             -1.6404061170760542e-05,
#             -1.1128588084829971e-05,
#             -7.065676982165314e-06,
#             -2.9246959911688464e-06
#         ],
#         "VelocityY_ST": [
#             -0.00022009710664860904,
#             -0.00021928884962107986,
#             -0.00020276573195587844,
#             -0.00022134666505735368,
#             -0.00023682623577769846,
#             -0.00024920518626458943
#         ],
#         "VelocityZ_ST": [
#             9.737274922372308e-06,
#             2.0819354631385067e-06,
#             -2.5126889795501484e-06,
#             -8.391260962525848e-06,
#             -1.5789588360348716e-05,
#             -2.239563036710024e-05
#         ],
#         "VertAccel_ST": [
#             9.808321952819824,
#             9.803400993347168,
#             9.804503440856934,
#             9.80403995513916,
#             9.80349349975586,
#             9.803778648376465
#         ],
#         "ts_send": "2024-08-08 20:29:30.037169"
#     },