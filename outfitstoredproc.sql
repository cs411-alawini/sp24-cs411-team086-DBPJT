DROP PROCEDURE IF EXISTS GenerateOutfit; 
CREATE PROCEDURE GenerateOutfit(IN p_user_id INT, IN p_city_id INT)
proc_label: BEGIN
    DECLARE p_temp_from INT;
    DECLARE p_temp_to INT;
    DECLARE city_min_temp INT;
    DECLARE city_max_temp INT;
    DECLARE category_count INT;
    DECLARE apparel_count INT;
    
    -- Get the city's temperature range
    SELECT Min_temp, Max_temp INTO city_min_temp, city_max_temp FROM weather WHERE cityID = p_city_id order by date DESC limit 1;

      -- Count the number of categories
      SELECT COUNT(DISTINCT category) INTO category_count FROM apparel WHERE Temp_from <= city_min_temp AND Temp_to >= city_max_temp;
      SELECT COUNT(*) INTO apparel_count FROM apparel WHERE Temp_from <= city_min_temp AND Temp_to >= city_max_temp;
        
        IF apparel_count = 0 THEN
            SELECT 'No available apparels for the given temperature range' AS message;
            LEAVE proc_label;
        END IF;
      
      -- Generate outfit for each category
      WHILE category_count > 0 DO
          -- Select an apparel item for each category within the temperature range
          INSERT IGNORE INTO outfit (Season, Datecreated, user_id, apparelID) 
          SELECT 'Spring', NOW(), p_user_id, 
              (SELECT ApparelID 
                FROM apparel 
                 WHERE Temp_from <= city_min_temp AND Temp_to >= city_max_temp 
                ORDER BY RAND()
                LIMIT 1)
          LIMIT 1;
          
          SET category_count = category_count - 1;
      END WHILE;

END;

DROP TRIGGER IF EXISTS after_usersubscribeslist_insert;
CREATE TRIGGER after_usersubscribeslist_insert
AFTER INSERT ON usersubscribeslist
FOR EACH ROW
BEGIN
    CALL GenerateOutfit(NEW.user_id,NEW.city_id);
END;




DELIMITER //

CREATE PROCEDURE register_user(
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(50),
    IN p_userid INT,
    IN p_gender VARCHAR(10)
)
BEGIN
    DECLARE username_count INT;

    -- Check if the username already exists
    SELECT COUNT(*) INTO username_count FROM user WHERE username = p_username;

    IF username_count > 0 THEN
        -- Username already exists, rollback the transaction
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists', MYSQL_ERRNO = 1001;
    ELSE
        -- Username doesn't exist, proceed with user registration
        START TRANSACTION;
        INSERT INTO user (username, password, userid, gender) VALUES (p_username, p_password, p_userid, p_gender);
        
        IF ROW_COUNT() > 0 THEN
            -- Registration successful, commit the transaction
            COMMIT;
        ELSE
            -- Registration failed, rollback the transaction
            ROLLBACK;
            SIGNAL SQLSTATE '45000';
        END IF;
    END IF;
END //

DELIMITER ;
