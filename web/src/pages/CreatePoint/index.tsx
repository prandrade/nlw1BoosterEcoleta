/* eslint-disable no-unused-vars */
import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { Map, TileLayer, Marker } from 'react-leaflet';
import { LeafletMouseEvent } from 'leaflet';
import axios from 'axios';
import swal from 'sweetalert';
import Geocode from 'react-geocode';
import InputMask from 'react-input-mask';

import Dropzone from '../../components/Dropzone';

import api from '../../services/api';

import './styles.css';

import logo from '../../assets/logo.svg';

// #region Interface

interface Item {
  id: number;
  title: string;
  imageUrl: string;
}

interface IBGEUFResponse {
  sigla: string;
}

interface IBGECityResponse {
  nome: string;
}

interface GoogleResponse {
  long_name: string;
  short_name: string;
  types: string[];
}

// #endregion Interface

// #region  Enum

enum SearchType {
  FromLatLng,
  FromAddress,
}

// #endregion Enum

const CreatePoint = () => {
  const history = useHistory();

  // #region useStates

  const [items, setItems] = useState<Item[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  // const [initialPosition, setInitialPosition] = useState<[number, number]>([
  //   0,
  //   0,
  // ]);

  const [selectedUf, setSelectedUf] = useState('0');
  const [selectedCity, setSelectedCity] = useState('0');
  const [selectedPosition, setSelectedPosition] = useState<[number, number]>([
    0,
    0,
  ]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedFile, setSelectedFile] = useState<File>();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
  });
  // #endregion useStates

  // #region useEffect

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;

      // setInitialPosition([latitude, longitude]);
      setSelectedPosition([latitude, longitude]);

      findLocation(
        SearchType.FromLatLng,
        latitude.toString(),
        longitude.toString(),
      );
    });
  }, []);

  useEffect(() => {
    api.get('items').then((response) => {
      setItems(response.data);
    });
  }, []);

  useEffect(() => {
    const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados';

    axios.get<IBGEUFResponse[]>(url).then((response) => {
      const ufInitials = response.data.map((uf) => uf.sigla);

      setUfs(ufInitials);
    });
  }, []);

  useEffect(() => {
    if (selectedUf === '0') {
      setCities([]); // Limpa as cidades
      return;
    }

    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios`;

    axios.get<IBGECityResponse[]>(url).then((response) => {
      const cityName = response.data.map((city) => city.nome);

      setCities(cityName);
    });
  }, [selectedUf]);

  // #endregion useEffect

  // #region Aditional functions

  /**
   * Find location by latitude and longitude or by address
   * @param searchType Location search type (FromLatLng or FromAddress)
   * @param latitude Address latitude (only required for search type FromLatLng)
   * @param longitude Address longitude (only required for search type FromLatLng)
   * @param address Address to find latitude and longitude
   */
  function findLocation(
    searchType: SearchType,
    latitude?: string,
    longitude?: string,
    address?: string,
  ) {
    // Carregar a chave de API (Obrigatório)
    Geocode.setApiKey('AIzaSyDh6rKij2gDx5YC1S7wnezmd2KDLBybRDg');

    if (
      searchType === SearchType.FromLatLng &&
      latitude !== undefined &&
      latitude !== '' &&
      longitude !== undefined &&
      longitude !== ''
    ) {
      // Carregar a cidade com base na longitude e latitude
      Geocode.fromLatLng(latitude, longitude).then(
        (response) => {
          // Pegar o resultado que contém somente Cidade e Estado
          const resultIndex = response.results.length - 3;

          const addresses: GoogleResponse[] =
            response.results[resultIndex].address_components;

          let uf = '';
          let city = '';

          // ForEach para percorrer todos os componentes de endereço
          addresses.forEach((address) => {
            switch (address.types[0]) {
              case 'administrative_area_level_1': // Estado
                uf = address.short_name;
                break;
              case 'administrative_area_level_2': // Cidade
                city = address.long_name;
                break;
              default:
                break;
            }
          });

          // Atualizar o campo 'UF' conforme encontrado no mapa
          const ufElement = document.getElementById('uf');
          if (ufElement !== null) {
            ufElement.nodeValue = uf;
          }

          // Atualizar o campo 'Cidade' conforme encontrado no mapa
          const cityElement = document.getElementById('city');
          if (cityElement !== null) {
            cityElement.nodeValue = city;
          }

          setSelectedUf(uf);
          setSelectedCity(city);
        },
        (error) => {
          swal({
            title: 'Carregar endereço',
            text: `Não conseguimos buscar seu endereço no mapa\nInforme o endereço manualmente`,
            icon: 'error',
            buttons: [false, 'Ok'],
            closeOnEsc: false,
            closeOnClickOutside: false,
          });
        },
      );
    } else if (
      searchType === SearchType.FromAddress &&
      address !== undefined &&
      address !== ''
    ) {
      // Buscar longitude e latitude da cidade (Força busca na região Brasil)
      Geocode.fromAddress(address, '', 'pt-BR', 'br').then(
        (response) => {
          const { lat, lng } = response.results[0].geometry.location;

          // Marcar cidade no mapa
          setSelectedPosition([lat, lng]);
        },
        (error) => {},
      );
    }
  }

  function handleSelectedUf(event: ChangeEvent<HTMLSelectElement>) {
    const uf = event.target.value;
    setSelectedUf(uf);
  }

  function handleSelectedCity(event: ChangeEvent<HTMLSelectElement>) {
    const city = event.target.value;

    setSelectedCity(city);

    // Buscar latitude e longitude da cidade e marcar no mapa
    findLocation(SearchType.FromAddress, '', '', city);
  }

  function handleMapClick(event: LeafletMouseEvent) {
    const { lat, lng } = event.latlng;

    setSelectedPosition([lat, lng]);

    // Buscar UF e cidade e atualizar os campos
    findLocation(SearchType.FromLatLng, lat.toString(), lng.toString());
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData({ ...formData, [name]: value });
  }

  function handleSelectItem(id: number) {
    const alreadySelected = selectedItems.findIndex((item) => item === id);

    if (alreadySelected >= 0) {
      const filteredItems = selectedItems.filter((item) => item !== id);

      setSelectedItems(filteredItems);
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const { name, email, whatsapp } = formData;
    const [latitude, longitude] = selectedPosition;
    const city = selectedCity;
    const uf = selectedUf;
    const items = selectedItems;

    // #region Validações

    if (!selectedFile) {
      swal({
        title: 'Adicione uma imagem do ponto de coleta!',
        icon: 'warning',
        buttons: [false, 'Ok. Vamos fazer isso!'],
        closeOnEsc: false,
        closeOnClickOutside: false,
      });

      return;
    }

    if (uf === '0') {
      swal({
        title: 'Escolha um estado (UF)!',
        icon: 'warning',
        buttons: [false, 'Ok. Vamos fazer isso!'],
        closeOnEsc: false,
        closeOnClickOutside: false,
      });

      return;
    }

    if (city === '0') {
      swal({
        title: 'Escolha a sua cidade!',
        icon: 'warning',
        buttons: [false, 'Ok. Vamos fazer isso!'],
        closeOnEsc: false,
        closeOnClickOutside: false,
      });

      return;
    }

    if (items.length === 0) {
      swal({
        title: 'Selecione ao menos 1 item de coleta!',
        icon: 'warning',
        buttons: [false, 'Ok. Vamos fazer isso!'],
        closeOnEsc: false,
        closeOnClickOutside: false,
      });

      return;
    }
    // #endregion Validações

    const data = new FormData();

    data.append('name', name);
    data.append('email', email);
    data.append('whatsapp', whatsapp);
    data.append('latitude', String(latitude));
    data.append('longitude', String(longitude));
    data.append('city', city);
    data.append('uf', uf);
    data.append('items', items.join(','));
    data.append('image', selectedFile);

    await api.post('points', data);

    swal({
      title: 'Ponto de coleta criado!',
      text: 'Você será redirecionado para a página inicial',
      icon: 'success',
      buttons: [false, 'Ok. Me leve até lá!'],
      closeOnEsc: false,
      closeOnClickOutside: false,
    }).then((value) => {
      if (value) {
        history.push('/');
      }
    });
  }

  // #endregion Aditional functions

  // #region Return
  return (
    <div id="page-create-point">
      <header>
        <img src={logo} alt="Ecoleta" />

        <Link to="/">
          <FiArrowLeft />
          Voltar para home
        </Link>
      </header>

      <form onSubmit={handleSubmit}>
        <h1>Cadastro do ponto de coleta</h1>

        <Dropzone onFileUploaded={setSelectedFile} />

        <fieldset>
          <legend>
            <h2>Dados</h2>
          </legend>

          <div className="field">
            <label htmlFor="name">Nome da entidade</label>
            <input
              type="text"
              name="name"
              id="name"
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="field-group">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                name="email"
                id="email"
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="whatsapp">WhatsApp</label>
              <InputMask
                mask="(99) 9 9999-9999"
                maskChar=" "
                type="text"
                name="whatsapp"
                id="whatsapp"
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <h2>Endereço</h2>
            <span>Selecione o endereço no mapa</span>
          </legend>

          <Map center={selectedPosition} zoom={15} onClick={handleMapClick}>
            <TileLayer
              attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker position={selectedPosition} />
          </Map>

          <div className="field-group">
            <div className="field">
              <label htmlFor="uf">Estado (UF)</label>
              <select
                name="uf"
                id="uf"
                value={selectedUf}
                onChange={handleSelectedUf}
              >
                <option value="0">Selecione uma UF</option>
                {ufs.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="city">Cidade</label>
              <select
                name="city"
                id="city"
                value={selectedCity}
                onChange={handleSelectedCity}
              >
                <option value="0">Selecione uma cidade</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <h2>Ítens de coleta</h2>
            <span>Selecione um ou mais itens abaixo</span>
          </legend>

          <ul className="items-grid">
            {items.map((item) => (
              <li
                key={item.id}
                onClick={() => handleSelectItem(item.id)}
                className={selectedItems.includes(item.id) ? 'selected' : ''}
              >
                <img src={item.imageUrl} alt={item.title} />
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
        </fieldset>
        <button type="submit">Cadastrar ponto de coleta</button>
      </form>
    </div>
  );
  // #endregion Return
};

export default CreatePoint;
