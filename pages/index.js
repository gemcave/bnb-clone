import houses from './houses.json';
import House from '../components/House';
import Layout from '../components/Layout.js';

const Index = () => {
  const content = (
    <div>
      <h2>Places to stay</h2>
      <div className="houses">
        {houses.map((house, index) => (
          <House key={index} {...house} />
        ))}
      </div>
      <style jsx>{`
        .houses {
          display: grid;
          grid-template-columns: 50% 50%;
          grid-template-rows: 300px 300px;
          grid-gap: 40px;
        }
      `}</style>
    </div>
  );
  return <Layout content={content} />;
};

export default Index;