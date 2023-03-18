import React, {useCallback} from 'react';

import {uniq} from 'lodash';

import {useNavigation} from '@react-navigation/native';
import {TouchableOpacity} from 'react-native';
import * as Sentry from 'sentry-expo';

import {HStack, View, VStack} from 'components/core';

import {Tab, TabControl} from 'components/TabControl';
import {useAvalancheCenterMetadata} from 'hooks/useAvalancheCenterMetadata';
import {AvalancheCenterID, AvalancheForecastZone} from 'types/nationalAvalancheCenter';

import {AvalancheCenterLogo} from 'components/AvalancheCenterLogo';
import {Dropdown} from 'components/content/Dropdown';
import {incompleteQueryState, NotFound, QueryState} from 'components/content/QueryState';
import {AvalancheTab} from 'components/forecast/AvalancheTab';
import {ObservationsTab} from 'components/forecast/ObservationsTab';
import {WeatherTab} from 'components/forecast/WeatherTab';
import {HomeStackNavigationProps} from 'routes';
import {notFound} from 'types/requests';
import {formatRequestedTime, RequestedTime} from 'utils/date';

export interface AvalancheForecastProps {
  zoneName: string;
  center_id: AvalancheCenterID;
  requestedTime: RequestedTime;
  forecast_zone_id: number;
}

export const AvalancheForecast: React.FunctionComponent<AvalancheForecastProps> = ({center_id, requestedTime, forecast_zone_id}: AvalancheForecastProps) => {
  const centerResult = useAvalancheCenterMetadata(center_id);
  const center = centerResult.data;

  const navigation = useNavigation<HomeStackNavigationProps>();
  const onZoneChange = useCallback(
    zoneName => {
      if (center) {
        const zone = center?.zones.find(z => z.name === zoneName && z.status === 'active');
        // TODO: consider possible improvements here
        // 1) nice-to-have: make sure we land on the same sub-tab (Avalanche vs Forecast vs Obs)
        // 2) nice-to-have: navigation causes a full reload on this screen - can we just do the equivalent of setState in a browser?
        //    i.e. update the navigation stack, but then manage re-rendering internally. we shouldn't need to re-render the toolbar after making this transition.
        navigation.navigate('forecast', {
          zoneName: zone.name,
          center_id: center_id,
          forecast_zone_id: zone.id,
          requestedTime: formatRequestedTime(requestedTime),
        });
      }
    },
    [navigation, center, center_id, requestedTime],
  );

  const onReturnToMapView = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  if (incompleteQueryState(centerResult)) {
    return <QueryState results={[centerResult]} />;
  }

  const zone: AvalancheForecastZone | undefined = center.zones.find(item => item.id === forecast_zone_id);
  if (!zone) {
    Sentry.Native.captureException(new Error(`Avalanche center ${center_id} had no zone with id ${forecast_zone_id}: ${JSON.stringify(center)}`));
    return <NotFound what={[notFound('the avalanche forecast zone')]} />;
  }

  const zones = uniq(center.zones.filter(z => z.status === 'active').map(z => z.name));

  return (
    <VStack style={{height: '100%', width: '100%', justifyContent: 'space-between'}}>
      <HStack justifyContent="space-between" alignItems="center" space={8} width="100%" height={64}>
        <View pl={8} py={8}>
          <TouchableOpacity onPress={onReturnToMapView}>
            <AvalancheCenterLogo style={{height: 48}} avalancheCenterId={center_id} />
          </TouchableOpacity>
        </View>
        <View flex={1} mr={8}>
          <Dropdown items={zones} selectedItem={zone.name} onSelectionChange={onZoneChange} bg="white" height={48} />
        </View>
      </HStack>
      <TabControl backgroundColor="white">
        <Tab title="Avalanche">
          <AvalancheTab
            elevationBandNames={zone.config.elevation_band_names}
            center={center}
            center_id={center_id}
            forecast_zone_id={forecast_zone_id}
            requestedTime={requestedTime}
          />
        </Tab>
        <Tab title="Weather">
          <WeatherTab zone={zone} center_id={center_id} requestedTime={requestedTime} />
        </Tab>
        <Tab title="Observations">
          <ObservationsTab zone_name={zone.name} center_id={center_id} requestedTime={requestedTime} />
        </Tab>
      </TabControl>
    </VStack>
  );
};
