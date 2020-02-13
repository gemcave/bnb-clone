import Head from 'next/head';

import Layout from '../../components/Layout';
import HouseForm from '../../components/HouseForm';

const NewHouse = () => (
  <Layout
    content={
      <>
        <Head>
          <title>Add a new house</title>
        </Head>

        <HouseForm edit={false} />
      </>
    }
  />
);

export default NewHouse;
