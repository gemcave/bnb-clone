import axios from 'axios';
import Head from 'next/head';
import Layout from '../../components/Layout';
import HouseForm from '../../components/HouseForm';

const EditHouse = props => (
  <Layout
    content={
      <>
        <Head>
          <title>Edit house</title>
        </Head>

        <HouseForm edit house={props.house} />
      </>
    }
  />
);

EditHouse.getInitialProps = async ({ query }) => {
  const { id } = query;
  const response = await axios.get(`http://localhost:3000/api/houses/${id}`);

  return {
    house: response.data,
  };
};

export default EditHouse;
