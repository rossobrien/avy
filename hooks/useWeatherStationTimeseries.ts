import {useContext} from 'react';

import {useQuery, useQueryClient} from '@tanstack/react-query';

import {ClientContext, ClientProps} from 'clientContext';
import AvalancheCenterMetadata from 'hooks/useAvalancheCenterMetadata';
import {ApiError, OpenAPI, StationMetadata, TimeseriesDataService} from 'types/generated/snowbound';
import {AvalancheCenterID} from 'types/nationalAvalancheCenter';
import {EnglishUnit, MetricUnit, Unit, Variable} from 'types/snowbound';
import {toSnowboundStringUTC} from 'utils/date';

type Source = 'nwac' | 'snotel' | 'mesowest';

interface Props {
  center: AvalancheCenterID;
  stids: string[];
  sources: Source[];
  startDate: Date;
  endDate: Date;
}

interface VariableDescriptor {
  variable: Variable;
  long_name: string;
  default_unit: Unit;
  english_unit: EnglishUnit;
  metric_unit: MetricUnit;
  rounding: number; // is this really a bool? looks like it's always 0 or 1 in limited testing. or is it a place signifier? no idea
}

type Observations = Record<Variable, number[] | null[]> & {
  date_time: string[];
};

interface Station extends StationMetadata {
  observations: Observations;
}

export interface TimeSeries {
  UNITS: Record<string, string>;
  VARIABLES: VariableDescriptor[];
  STATION: Station[];
}

function floorToHour(date: Date) {
  const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / MILLISECONDS_PER_HOUR) * MILLISECONDS_PER_HOUR);
}

export const useWeatherStationTimeseries = ({center, sources, stids, startDate, endDate}: Props) => {
  const queryClient = useQueryClient();
  const clientProps = useContext<ClientProps>(ClientContext);
  const sourceString = sources.join(',');
  const stidString = stids.join(',');

  return useQuery<TimeSeries, ApiError | Error>(
    ['timeseries', center, sourceString, stidString, startDate.toISOString(), endDate.toISOString()],
    async () => {
      // Get the snowbound API token for the center
      const metadata = await AvalancheCenterMetadata.fetchQuery(queryClient, clientProps.nationalAvalancheCenterHost, center);
      const token = metadata.widget_config.stations.token;

      OpenAPI.BASE = clientProps.snowboundHost;
      const timeseries = await TimeseriesDataService.getStationDataTimeseriesWxV1StationDataTimeseriesGet({
        source: sourceString,
        stid: stidString,
        startDate: toSnowboundStringUTC(floorToHour(startDate)),
        endDate: toSnowboundStringUTC(floorToHour(endDate)),
        output: 'mesowest',
        token,
      });

      return timeseries;
    },
    // {
    //   // TODO: figure out sane cache policy here. Probably don't want to keep this in memory forever.
    //   // staleTime: 24 * 60 * 60 * 1000, // don't bother re-fetching for one day (in milliseconds)
    //   // cacheTime: 5 * 60 * 1000,
    // },
  );
};
