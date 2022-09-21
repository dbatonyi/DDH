const React = require('react');
const MainLayout = require('./layouts/mainLayout');
const Sidebar = require('./partials/sidebar');
 
function settings(props) {
  return (
    <MainLayout title={props.title}>
        <div className="dashboard-container">
        <Sidebar />
          <div className="dashboard-container__main">
            {props.systemMessage ? <div className='system-message'>{props.systemMessage}</div> : null}
              <div className="settings-container">
                    <label>Export database</label>
                    <a href='/export-database'>Export tasks table (WIP)</a>
              </div>
          </div>
        </div>
    </MainLayout>
  );
}
 
module.exports = settings;